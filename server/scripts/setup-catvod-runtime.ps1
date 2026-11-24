$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ServerRoot = Split-Path -Parent $PSScriptRoot
$RuntimeRoot = Join-Path $ServerRoot 'catvod-runtime'
$TempRoot = Join-Path $env:TEMP 'cinebox-catvod-runtime-setup'
$Archive = Join-Path $TempRoot 'mytvbox-main.zip'

# 优先使用 JAVA_HOME；若未设置或无效，则从当前 java 命令报告的 java.home
# 获取真实 JDK 目录。不要从 javac 的 Oracle javapath 转发器推断 JDK 路径。
# CineBox 开发环境：直接使用已确认的 JDK 21
$JdkHome = 'D:\Codex\jdk'

if (-not (Test-Path "$JdkHome\bin\java.exe")) {
    throw "找不到 java.exe：$JdkHome\bin\java.exe"
}

if (-not (Test-Path "$JdkHome\bin\javac.exe")) {
    throw "找不到 javac.exe：$JdkHome\bin\javac.exe"
}

if (-not (Test-Path "$JdkHome\bin\jar.exe")) {
    throw "找不到 jar.exe：$JdkHome\bin\jar.exe"
}

$JdkBin = Join-Path $JdkHome 'bin'
$Javac = Join-Path $JdkBin 'javac.exe'
$Java = Join-Path $JdkBin 'java.exe'
$Jar = Join-Path $JdkBin 'jar.exe'

Write-Host "使用 JDK：$JdkHome"

# 从 JDK release 文件读取版本，避免 PowerShell 5.1 处理 Java stderr
$releaseFile = Join-Path $JdkHome 'release'
$releaseText = [System.IO.File]::ReadAllText($releaseFile)

$versionMatch = [regex]::Match(
    $releaseText,
    '(?m)^JAVA_VERSION="([^"]+)"'
)

if (-not $versionMatch.Success) {
    throw "无法读取 JDK 版本：$releaseFile"
}

$versionText = $versionMatch.Groups[1].Value
$javaMajor = [int]($versionText.Split('.')[0])

if ($javaMajor -lt 21) {
    throw "当前 Java 版本为 $versionText，需要 JDK 21 或更高版本。"
}

Write-Host "Java 版本：$versionText"

$JdkBin = Join-Path $JdkHome 'bin'
$Javac = Join-Path $JdkBin 'javac.exe'
$Java = Join-Path $JdkBin 'java.exe'
$Jar = Join-Path $JdkBin 'jar.exe'
Write-Host "使用 JDK：$JdkHome"

# 从 JDK 自带的 release 文件读取版本，避免 PowerShell 5.1 处理 Java stderr 时发生异常
$releaseFile = Join-Path $JdkHome 'release'

if (-not (Test-Path $releaseFile)) {
    throw "JDK release 文件不存在：$releaseFile"
}

$releaseText = [System.IO.File]::ReadAllText($releaseFile)

$versionMatch = [regex]::Match(
    $releaseText,
    '(?m)^JAVA_VERSION="([^"]+)"'
)

if (-not $versionMatch.Success) {
    throw "无法从 JDK release 文件识别 Java 版本：$releaseFile"
}

$versionText = $versionMatch.Groups[1].Value

$majorMatch = [regex]::Match($versionText, '^([0-9]+)')

if (-not $majorMatch.Success) {
    throw "无法识别 Java 主版本：$versionText"
}

$javaMajor = [int]$majorMatch.Groups[1].Value

if ($javaMajor -lt 21) {
    throw "当前 JDK 主版本为 $javaMajor，需要 JDK 21 或更高版本。"
}

Write-Host "Java 版本：$versionText"

New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
if (-not (Test-Path (Join-Path $RuntimeRoot 'src'))) {
    Write-Host '正在下载 tvbox-spider-server 源码……'
    Invoke-WebRequest -Uri 'https://codeload.github.com/honey52160/mytvbox/zip/refs/heads/main' -OutFile $Archive
    $ExtractRoot = Join-Path $TempRoot 'extract'
    if (Test-Path $ExtractRoot) { Remove-Item $ExtractRoot -Recurse -Force }
    Expand-Archive -Path $Archive -DestinationPath $ExtractRoot -Force
    $SourceRoot = Join-Path $ExtractRoot 'mytvbox-main\tvbox-spider-server'
    if (-not (Test-Path (Join-Path $SourceRoot 'src'))) { throw '下载的仓库中没有找到 tvbox-spider-server/src。' }
    New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null
    Copy-Item -Path (Join-Path $SourceRoot '*') -Destination $RuntimeRoot -Recurse -Force
} else {
    Write-Host '检测到已有 catvod-runtime 源码，跳过下载。'
}

# JarImporter 在上游源码中默认把子进程写成 bin/java；这里显式适配 Windows 的 java.exe。
$JarImporterSource = Join-Path $RuntimeRoot 'src\com\github\catvod\host\JarImporter.java'
if (Test-Path $JarImporterSource) {
    $sourceText = [System.IO.File]::ReadAllText($JarImporterSource)
    $oldJavaPath = 'String javaBin = new File(System.getProperty("java.home"), "bin/java").getAbsolutePath();'
    $newJavaPath = 'String javaExecutable = System.getProperty("os.name").toLowerCase().contains("win") ? "bin/java.exe" : "bin/java";' + [Environment]::NewLine + '        String javaBin = new File(System.getProperty("java.home"), javaExecutable).getAbsolutePath();'
    if ($sourceText.Contains($oldJavaPath)) {
        $sourceText = $sourceText.Replace($oldJavaPath, $newJavaPath)
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($JarImporterSource, $sourceText, $utf8NoBom)
    }
}

$Libs = Join-Path $RuntimeRoot 'libs'
$DexLibs = Join-Path $Libs 'dex2jar'
New-Item -ItemType Directory -Force -Path $Libs, $DexLibs | Out-Null
$Mirror = 'https://maven.aliyun.com/repository/public'
$Deps = @(
    @{ Group='com/squareup/okhttp3'; Artifact='okhttp'; Version='3.12.11'; File='okhttp-3.12.11.jar'; Sub='' },
    @{ Group='com/squareup/okio'; Artifact='okio'; Version='1.17.5'; File='okio-1.17.5.jar'; Sub='' },
    @{ Group='com/google/code/gson'; Artifact='gson'; Version='2.10.1'; File='gson-2.10.1.jar'; Sub='' },
    @{ Group='org/json'; Artifact='json'; Version='20190722'; File='json-20190722.jar'; Sub='' },
    @{ Group='org/jsoup'; Artifact='jsoup'; Version='1.14.1'; File='jsoup-1.14.1.jar'; Sub='' },
    @{ Group='org/apache/commons'; Artifact='commons-lang3'; Version='3.12.0'; File='commons-lang3-3.12.0.jar'; Sub='' },
    @{ Group='org/mozilla'; Artifact='rhino'; Version='1.7.14'; File='rhino-1.7.14.jar'; Sub='' },
    @{ Group='de/femtopedia/dex2jar'; Artifact='d2j-base-cmd'; Version='2.4.28'; File='d2j-base-cmd-2.4.28.jar'; Sub='dex2jar' },
    @{ Group='de/femtopedia/dex2jar'; Artifact='d2j-external'; Version='2.4.28'; File='d2j-external-2.4.28.jar'; Sub='dex2jar' },
    @{ Group='de/femtopedia/dex2jar'; Artifact='d2j-jasmin'; Version='2.4.28'; File='d2j-jasmin-2.4.28.jar'; Sub='dex2jar' },
    @{ Group='de/femtopedia/dex2jar'; Artifact='d2j-smali'; Version='2.4.28'; File='d2j-smali-2.4.28.jar'; Sub='dex2jar' },
    @{ Group='de/femtopedia/dex2jar'; Artifact='dex-ir'; Version='2.4.28'; File='dex-ir-2.4.28.jar'; Sub='dex2jar' },
    @{ Group='de/femtopedia/dex2jar'; Artifact='dex-reader'; Version='2.4.28'; File='dex-reader-2.4.28.jar'; Sub='dex2jar' },
    @{ Group='de/femtopedia/dex2jar'; Artifact='dex-reader-api'; Version='2.4.28'; File='dex-reader-api-2.4.28.jar'; Sub='dex2jar' },
    @{ Group='de/femtopedia/dex2jar'; Artifact='dex-tools'; Version='2.4.28'; File='dex-tools-2.4.28.jar'; Sub='dex2jar' },
    @{ Group='de/femtopedia/dex2jar'; Artifact='dex-translator'; Version='2.4.28'; File='dex-translator-2.4.28.jar'; Sub='dex2jar' },
    @{ Group='de/femtopedia/dex2jar'; Artifact='dex-writer'; Version='2.4.28'; File='dex-writer-2.4.28.jar'; Sub='dex2jar' },
    @{ Group='org/antlr'; Artifact='antlr4-runtime'; Version='4.13.2'; File='antlr4-runtime-4.13.2.jar'; Sub='dex2jar' },
    @{ Group='org/ow2/asm'; Artifact='asm'; Version='9.8'; File='asm-9.8.jar'; Sub='dex2jar' },
    @{ Group='org/ow2/asm'; Artifact='asm-commons'; Version='9.8'; File='asm-commons-9.8.jar'; Sub='dex2jar' },
    @{ Group='org/ow2/asm'; Artifact='asm-tree'; Version='9.8'; File='asm-tree-9.8.jar'; Sub='dex2jar' },
    @{ Group='org/ow2/asm'; Artifact='asm-analysis'; Version='9.8'; File='asm-analysis-9.8.jar'; Sub='dex2jar' },
    @{ Group='org/ow2/asm'; Artifact='asm-util'; Version='9.8'; File='asm-util-9.8.jar'; Sub='dex2jar' }
)

Write-Host '正在下载 Java 依赖……'
foreach ($dep in $Deps) {
    $targetDir = if ($dep.Sub) { Join-Path $Libs $dep.Sub } else { $Libs }
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    $target = Join-Path $targetDir $dep.File
    if (Test-Path $target) { continue }
    $uri = "$Mirror/$($dep.Group)/$($dep.Artifact)/$($dep.Version)/$($dep.File)"
    try {
        Invoke-WebRequest -Uri $uri -OutFile $target
    } catch {
        if (Test-Path $target) { Remove-Item $target -Force }
        throw "依赖下载失败：$uri`n$($_.Exception.Message)"
    }
}

$Src = Join-Path $RuntimeRoot 'src'
$Build = Join-Path $RuntimeRoot 'build'
$Classes = Join-Path $Build 'classes'
New-Item -ItemType Directory -Force -Path $Build | Out-Null
if (Test-Path $Classes) { Remove-Item $Classes -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Classes | Out-Null
$jarFiles = @(Get-ChildItem -Path $Libs -Recurse -Filter '*.jar' -File | ForEach-Object FullName)
$classpath = $jarFiles -join ';'
$sourceFiles = @(Get-ChildItem -Path $Src -Recurse -Filter '*.java' -File | ForEach-Object FullName)
if ($sourceFiles.Count -eq 0) { throw "没有找到 Java 源文件：$Src" }
Write-Host "正在编译 $($sourceFiles.Count) 个 Java 文件……"
& $Javac -encoding UTF-8 -nowarn --add-modules jdk.httpserver -cp $classpath -d $Classes $sourceFiles
if ($LASTEXITCODE -ne 0) { throw "javac 编译失败，退出码：$LASTEXITCODE" }

$manifest = Join-Path $Build 'MANIFEST.MF'
[System.IO.File]::WriteAllText($manifest, "Manifest-Version: 1.0`r`nMain-Class: com.github.catvod.host.HostMain`r`n`r`n", [System.Text.Encoding]::ASCII)
$outputJar = Join-Path $Build 'tvbox-spider-server.jar'
& $Jar --create --file $outputJar --manifest $manifest -C $Classes .
if ($LASTEXITCODE -ne 0) { throw "jar 打包失败，退出码：$LASTEXITCODE" }

$configDir = Join-Path $RuntimeRoot 'config'
New-Item -ItemType Directory -Force -Path $configDir | Out-Null
$configFile = Join-Path $configDir 'spiders.json'
if (-not (Test-Path $configFile)) {
    [System.IO.File]::WriteAllText($configFile, '{"port":9978,"sites":[]}', [System.Text.Encoding]::UTF8)
}

Write-Host ''
Write-Host 'CatVod 兼容服务构建完成。'
Write-Host "运行目录：$RuntimeRoot"
Write-Host "构建产物：$outputJar"
Write-Host '下一步运行：powershell -ExecutionPolicy Bypass -File .\scripts\start-catvod-runtime.ps1'
