# ProfileReplayer PC 侧轮询：经 adb forward 抓平板 Decaid 导出 → 并入 PC 归档（hx-archive 同口径）
# 用法（需提权跑）：.\tablet-sync.ps1            # 抓一次
#                   .\tablet-sync.ps1 -IntervalSec 120   # 每 2 分钟轮询，Ctrl+C 停
param([int]$IntervalSec = 0, [string]$Inbox = "D:\vscode\.tools\hx-data\inbox")
$adb = "D:\android-dev\sdk\platform-tools\adb.exe"
$cfg = Get-Content -LiteralPath (Join-Path $PSScriptRoot "tablet.json") -Raw | ConvertFrom-Json
$skill = "C:\Users\ladios\.codex\skills\hyperex-history\scripts\hx-archive.mjs"
& $adb connect $cfg.connect | Out-Null
& $adb -s $cfg.connect forward tcp:$($cfg.localPort) tcp:$($cfg.decaidPort) | Out-Null
New-Item -ItemType Directory -Force -Path $Inbox | Out-Null
do {
  $ts = Get-Date -Format "yyyyMMdd-HHmmss"
  $file = Join-Path $Inbox "hyperex-history-tablet-$ts.json"
  try {
    Invoke-WebRequest -UseBasicParsing -NoProxy -TimeoutSec 60 "http://127.0.0.1:$($cfg.localPort)/api/v1/plugins/decenthyperexplugin.reaplugin/history-export" -OutFile $file
    node $skill add $file
  } catch { "抓取失败：$_" }
  # recorder（非 HyperEx 杯）导出：404 表示未装，跳过；装了就跟 HyperEx 同口径并入
  $recFile = Join-Path $Inbox "profilerecorder-tablet-$ts.json"
  try {
    Invoke-WebRequest -UseBasicParsing -NoProxy -TimeoutSec 60 "http://127.0.0.1:$($cfg.localPort)/api/v1/plugins/profilerecorder.reaplugin/history-export" -OutFile $recFile
    node $skill add $recFile
  } catch { Remove-Item -LiteralPath $recFile -ErrorAction SilentlyContinue }
  if ($IntervalSec -gt 0) { Start-Sleep -Seconds $IntervalSec }
} while ($IntervalSec -gt 0)
