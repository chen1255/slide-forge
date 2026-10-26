# slide-forge 一键安装与自检
# 用法：powershell -ExecutionPolicy Bypass -File .\install.ps1
#      powershell -ExecutionPolicy Bypass -File .\install.ps1 -SkipDemo
param([switch]$SkipDemo)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "== slide-forge 安装 ==" -ForegroundColor Cyan

# 1) 定位 Node（本机可能是绿色版，PATH 里没有）
$node = $null
$cmd = Get-Command node.exe -ErrorAction SilentlyContinue
if ($cmd) { $node = $cmd.Source }
if (-not $node) {
  foreach ($p in @('D:\node.exe', 'C:\Program Files\nodejs\node.exe', 'C:\Program Files (x86)\nodejs\node.exe')) {
    if (Test-Path $p) { $node = $p; break }
  }
}
if (-not $node) {
  throw "未找到 Node.js（需要 18 以上）。请先安装：https://nodejs.org/"
}
$env:Path = (Split-Path $node) + ';' + $env:Path
Write-Host ("Node: " + (& $node -v))

$npm = $null
$npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($npmCmd) { $npm = $npmCmd.Source }
if (-not $npm) {
  $candidate = Join-Path (Split-Path $node) 'npm.cmd'
  if (Test-Path $candidate) { $npm = $candidate }
}
if (-not $npm) { throw "未找到 npm.cmd，请检查 Node 安装是否完整" }

# 2) 安装依赖（必须用 $LASTEXITCODE 判定，npm 会把进度写到 stderr）
Write-Host "安装依赖 ..."
& $npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { throw "npm install 失败，退出码 $LASTEXITCODE" }

# 3) 自检
Write-Host "校验示例 deck ..."
& $node bin/slideforge.js check examples/demo.deck.yaml
if ($LASTEXITCODE -ne 0) { throw "示例 deck 校验失败，退出码 $LASTEXITCODE" }

if (-not $SkipDemo) {
  Write-Host "生成示例 PPTX 与 HTML ..."
  & $node bin/slideforge.js build examples/demo.deck.yaml
  if ($LASTEXITCODE -ne 0) { throw "示例构建失败，退出码 $LASTEXITCODE" }
  Write-Host "产物在 out\ 目录" -ForegroundColor Green
}

Write-Host "安装完成。常用命令：" -ForegroundColor Green
Write-Host "  node bin\slideforge.js build <spec.yaml>"
Write-Host "  node bin\slideforge.js new `"季度复盘`" --llm"
Write-Host "  node bin\slideforge.js template <brand.pptx>"
