# ProfileReplayer 真机无线调试接入：配对 → 连接 → 发现 Decaid 端口 → 存配置
# 用法（需提权跑）：
#   .\tablet-connect.ps1 -PairHost 192.168.x.x:配对端口 -PairCode 123456 -ConnectHost 192.168.x.x:连接端口
# 配对端口/码在「用配对码配对设备」弹窗里；连接端口在无线调试主页面。两者不同。
param(
  [Parameter(Mandatory=$true)][string]$PairHost,
  [Parameter(Mandatory=$true)][string]$PairCode,
  [Parameter(Mandatory=$true)][string]$ConnectHost,
  [int]$DecaidPort = 0,
  [int]$LocalPort = 4791
)
$adb = "D:\android-dev\sdk\platform-tools\adb.exe"
& $adb pair $PairHost $PairCode
if ($LASTEXITCODE -ne 0) { $PairCode | & $adb pair $PairHost }
& $adb connect $ConnectHost
& $adb devices
$found = $DecaidPort
if (-not $found) {
  $tcp = & $adb -s $ConnectHost shell "cat /proc/net/tcp /proc/net/tcp6"
  $ports = @{}
  foreach ($line in $tcp) {
    $f = -split $line
    if ($f.Count -gt 3 -and $f[3] -eq "0A") {
      $p = [Convert]::ToInt32(($f[1] -split ":")[1], 16)
      if ($p -ge 1024) { $ports[$p] = $true }
    }
  }
  foreach ($p in ($ports.Keys | Sort-Object)) {
    & $adb -s $ConnectHost forward tcp:$LocalPort tcp:$p | Out-Null
    try {
      $r = Invoke-WebRequest -UseBasicParsing -NoProxy -TimeoutSec 3 "http://127.0.0.1:$LocalPort/api/v1/plugins/decenthyperexplugin.reaplugin/status"
      if ($r.StatusCode -eq 200) { $found = $p; break }
    } catch {}
    & $adb -s $ConnectHost forward --remove tcp:$LocalPort | Out-Null
  }
}
if (-not $found) { "未发现 Decaid 端口。确认插件已启用，或把平时贴的导出地址端口用 -DecaidPort 传入重试。"; exit 1 }
& $adb -s $ConnectHost forward tcp:$LocalPort tcp:$found | Out-Null
$cfg = @{ connect = $ConnectHost; decaidPort = $found; localPort = $LocalPort } | ConvertTo-Json
Set-Content -LiteralPath (Join-Path $PSScriptRoot "tablet.json") -Value $cfg -Encoding UTF8
"Decaid 端口 = $found，本地转发 127.0.0.1:$LocalPort，配置已存 app/tools/tablet.json"
