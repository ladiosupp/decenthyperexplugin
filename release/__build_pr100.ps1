# 打包 ProfileRecorder v1.0.0 本地安装 ZIP（根目录 profilerecorder.reaplugin/）
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = "D:/vscode/decenthyperexplugin"
$pkg = "profilerecorder.reaplugin"
$out = Join-Path $root "release/ProfileRecorder_v1.0.0.zip"
if (Test-Path -LiteralPath $out) { Remove-Item -LiteralPath $out -Force }
$files = @("manifest.json","plugin.js","README.md","LICENSE","tests/verify_v0100.cjs")
$zip = [System.IO.Compression.ZipFile]::Open($out,"Create")
foreach ($f in $files) {
  [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,(Join-Path $root "$pkg/$f"),("$pkg/" + $f),[System.IO.Compression.CompressionLevel]::Optimal)
}
$zip.Dispose()
(Get-Item -LiteralPath $out).Length
(Get-FileHash -LiteralPath $out -Algorithm SHA256).Hash
$tmp = "D:/vscode/.tools/__zipcheck_pr100"
if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }
[System.IO.Compression.ZipFile]::ExtractToDirectory($out,$tmp)
node --check (Join-Path $tmp "$pkg/plugin.js")
node (Join-Path $tmp "$pkg/tests/verify_v0100.cjs") 2>&1 | Select-Object -Last 1
Remove-Item -LiteralPath $tmp -Recurse -Force

