Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = 'D:/vscode/decenthyperexplugin'
$tag = 'v2.2.48'
$pkg = 'decenthyperexplugin.reaplugin'
$out = Join-Path $root 'release/HyperExPulseFilter_v2.2.48.zip'
$stage = Join-Path $root 'release/__stage_2248'
$tarFile = Join-Path $root 'release/__stage_2248.tar'
if (Test-Path -LiteralPath $out) { Remove-Item -LiteralPath $out -Force }
if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
if (Test-Path -LiteralPath $tarFile) { Remove-Item -LiteralPath $tarFile -Force }
New-Item -ItemType Directory -Path $stage | Out-Null
git -C $root archive --format=tar -o $tarFile $tag
if ($LASTEXITCODE -ne 0) { throw 'git archive failed' }
tar -xf $tarFile -C $stage
if ($LASTEXITCODE -ne 0) { throw 'tar extract failed' }
if (-not (Test-Path -LiteralPath (Join-Path $stage "$pkg/plugin.js"))) { throw 'staged plugin.js missing' }
$files = @('manifest.json','plugin.js','README.md','LICENSE','HANDOFF_v02248.md','HyperEx_Flow_Calibration_Full.json','HyperEx_Flow_Calibration_Low_Water.json','tests/verify_v02248.cjs','tests/RESULTS_v02248.txt')
$zip = [System.IO.Compression.ZipFile]::Open($out,'Create')
foreach ($f in $files) {
  [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,(Join-Path $stage "$pkg/$f"),("$pkg/" + $f),[System.IO.Compression.CompressionLevel]::Optimal)
}
$zip.Dispose()
(Get-Item -LiteralPath $out).Length
(Get-FileHash -LiteralPath $out -Algorithm SHA256).Hash
$tmp = Join-Path $root 'release/__zipcheck_2248'
if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }
[System.IO.Compression.ZipFile]::ExtractToDirectory($out,$tmp)
node --check (Join-Path $tmp "$pkg/plugin.js")
node (Join-Path $tmp "$pkg/tests/verify_v02248.cjs") 2>&1 | Select-Object -Last 1
Remove-Item -LiteralPath $tmp -Recurse -Force
Remove-Item -LiteralPath $stage -Recurse -Force
Remove-Item -LiteralPath $tarFile -Force
