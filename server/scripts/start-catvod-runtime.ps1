$ErrorActionPreference = 'Stop'

$ServerRoot = Split-Path -Parent $PSScriptRoot
$RuntimeRoot = Join-Path $ServerRoot 'catvod-runtime'
$Classes = Join-Path $RuntimeRoot 'build\classes'
$Libs = Join-Path $RuntimeRoot 'libs'

# 检查编译产物
if (-not (Test-Path $Classes)) {
    throw '没有找到 CatVod 兼容服务编译产物。请先运行 setup-catvod-runtime.ps1'
}

# 检查 Java
$javaCommand = Get-Command java -ErrorAction SilentlyContinue

if (-not $javaCommand) {
    throw '没有找到 java，请检查 JDK 21 的 PATH。'
}

$classpath = "$Classes;$Libs\*"

Write-Host '正在启动 CatVod Spider 服务，端口 9978。保持此窗口运行。'
Write-Host '服务健康检查：http://127.0.0.1:9978/health'

# 使用参数数组传递 Java 参数，避免 PowerShell 5.1 参数解析问题
$javaArgs = @(
    '-Dfile.encoding=UTF-8'
    "-Dtvbox.home=$RuntimeRoot"
    '--add-modules=jdk.httpserver'
    '-cp'
    $classpath
    'com.github.catvod.host.HostMain'
    '-port'
    '9978'
)

& $javaCommand.Source @javaArgs

if ($LASTEXITCODE -ne 0) {
    throw "CatVod Runtime 启动失败，退出码：$LASTEXITCODE"
}