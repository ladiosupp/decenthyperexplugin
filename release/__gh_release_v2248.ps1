$inputText = "protocol=https`nhost=github.com`n`n"
$cred = $inputText | git credential fill
$tokenLine = $cred | Where-Object { $_ -like "password=*" } | Select-Object -First 1
if (-not $tokenLine) { Write-Output "NO_TOKEN"; exit 1 }
$env:GH_TOKEN = $tokenLine.Substring(9)
$env:HTTPS_PROXY = "http://127.0.0.1:57890"
gh release create v2.2.48 D:/vscode/decenthyperexplugin/release/HyperExPulseFilter_v2.2.48.zip --repo ladiosupp/decenthyperexplugin --title "v2.2.48：HEC 档（外部调流 + 插件监护学习 + 握手保险）" --notes-file D:/vscode/decenthyperexplugin/release/notes-v2.2.48.md --latest
