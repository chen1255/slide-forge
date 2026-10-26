# 用本机 PowerPoint 把 pptx 逐页导出成 PNG，用于目检
# 用法：powershell -ExecutionPolicy Bypass -File .\scripts\qa-render.ps1 -Pptx out\demo.pptx -Out out\png
param(
  [Parameter(Mandatory = $true)][string]$Pptx,
  [string]$Out = 'out\png'
)

$ErrorActionPreference = 'Stop'
$src = (Resolve-Path $Pptx).Path
if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
New-Item -ItemType Directory -Path $Out -Force | Out-Null
$outAbs = (Resolve-Path $Out).Path

$ppt = New-Object -ComObject PowerPoint.Application
try {
  $pres = $ppt.Presentations.Open($src, -1, 0, 0)
  $pres.SaveAs($outAbs, 18)   # 18 = ppSaveAsPNG
  $pres.Close()
} finally {
  $ppt.Quit()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ppt) | Out-Null
}

$count = (Get-ChildItem $outAbs | Measure-Object).Count
Write-Host ("导出 $count 页 PNG 到 $outAbs") -ForegroundColor Green
