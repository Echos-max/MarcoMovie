$ErrorActionPreference = "Stop"

$file = ".\server\catvod-runtime\src\com\github\catvod\host\SiteHolder.java"
$fullPath = (Resolve-Path $file).Path
$content = [System.IO.File]::ReadAllText($fullPath)

if ($content.Contains("tuneCzsappHttpClient")) {
    throw "检测到补丁方法已存在，停止操作。"
}

$callPattern = '(?m)^(?<indent>[ \t]*)local\s*=\s*jarLoader\.getSpider\(bean\.key,\s*bean\.api,\s*bean\.ext,\s*context\);'
$callMatches = [regex]::Matches($content, $callPattern)
$methodPattern = '(?m)^[ \t]*public\s+Spider\s+spider\s*\(\s*\)\s*\{'
$methodMatches = [regex]::Matches($content, $methodPattern)

if ($callMatches.Count -ne 1 -or $methodMatches.Count -ne 1) {
    throw "源码位置检查失败，未修改文件。"
}

$helperLines = @(
'    private void tuneCzsappHttpClient(Spider local) {'
'        try {'
'            ClassLoader pluginLoader = local.getClass().getClassLoader();'
'            Class<?> holderClass = Class.forName("com.github.catvod.spider.merge.m.b", true, pluginLoader);'
'            java.lang.reflect.Field singletonField = holderClass.getDeclaredField("a");'
'            singletonField.setAccessible(true);'
'            Object holder = singletonField.get(null);'
'            if (holder == null) return;'
'            java.lang.reflect.Field clientField = holder.getClass().getDeclaredField("a");'
'            clientField.setAccessible(true);'
'            Object current = clientField.get(holder);'
'            if (!(current instanceof okhttp3.OkHttpClient)) return;'
'            okhttp3.OkHttpClient oldClient = (okhttp3.OkHttpClient) current;'
'            okhttp3.OkHttpClient newClient = oldClient.newBuilder()'
'                .protocols(java.util.Collections.singletonList(okhttp3.Protocol.HTTP_1_1))'
'                .callTimeout(15L, java.util.concurrent.TimeUnit.SECONDS)'
'                .build();'
'            clientField.set(holder, newClient);'
'            android.util.Log.i("SiteHolder", "厂长专用 HTTP 客户端已切换为 HTTP/1.1");'
'        } catch (Throwable e) {'
'            android.util.Log.w("SiteHolder", "厂长 HTTP 客户端调整失败", e);'
'        }'
'    }'
)

$helper = [string]::Join("`n", $helperLines)
$callMatch = $callMatches[0]
$indent = $callMatch.Groups["indent"].Value

$callReplacement = $callMatch.Value + "`n" +
    $indent + 'if ("厂长".equals(bean.key) && "csp_Czsapp".equals(bean.api)) {' + "`n" +
    $indent + '    tuneCzsappHttpClient(local);' + "`n" +
    $indent + '}'

$content = $content.Replace($callMatch.Value, $callReplacement)

$methodMatch = [regex]::Match($content, $methodPattern)
$content = $content.Replace($methodMatch.Value, $helper + "`n`n" + $methodMatch.Value)

$backup = $fullPath + ".bak-czsapp-http11-" + (Get-Date -Format "yyyyMMdd-HHmmss")
Copy-Item -LiteralPath $fullPath -Destination $backup

try {
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($fullPath, $content, $encoding)

    $verify = [System.IO.File]::ReadAllText($fullPath)
    if (
        -not $verify.Contains("tuneCzsappHttpClient") -or
        -not $verify.Contains("Protocol.HTTP_1_1") -or
        -not $verify.Contains('"厂长".equals(bean.key)') -or
        -not $verify.Contains("callTimeout(15L")
    ) {
        throw "修改后验证失败。"
    }

    Write-Host "补丁写入并验证成功。" -ForegroundColor Green
    Write-Host "备份文件：$backup"
    Select-String -Path $fullPath -Pattern "tuneCzsappHttpClient|Protocol.HTTP_1_1|厂长专用 HTTP 客户端"
}
catch {
    Copy-Item -LiteralPath $backup -Destination $fullPath -Force
    throw "修改失败，已从备份恢复。原因：$_"
}
