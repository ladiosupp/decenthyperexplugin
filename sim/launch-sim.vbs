' HyperEx sim desktop launcher: ensure server on 4780, then open the page.
' Double-click safe: no console window. Deps: Node.js only (sim uses built-ins).
Option Explicit
Dim sh, fso, simDir, port, url, i, started, nodeExe
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
simDir = fso.GetParentFolderName(WScript.ScriptFullName)
port = 4780
url = "http://127.0.0.1:" & port & "/"

If Not Ready() Then
  nodeExe = ""
  On Error Resume Next
  nodeExe = sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
  If Not fso.FileExists(nodeExe) Then nodeExe = "node.exe"
  On Error GoTo 0
  sh.CurrentDirectory = simDir
  On Error Resume Next
  sh.Run """" & nodeExe & """ """ & simDir & "\server.js""", 0, False
  If Err.Number <> 0 Then
    MsgBox "Node.js not found. Install Node.js, then double-click again.", vbCritical, "HyperEx sim"
    WScript.Quit 1
  End If
  On Error GoTo 0
  started = False
  For i = 1 To 60
    WScript.Sleep 250
    If Ready() Then started = True : Exit For
  Next
  If Not started Then
    MsgBox "Sim server did not become ready on port " & port & "." & vbCrLf & "Check: node sim/server.js", vbCritical, "HyperEx sim"
    WScript.Quit 1
  End If
End If
On Error Resume Next
sh.Run """" & url & """", 1, False
On Error GoTo 0

Function Ready()
  Dim http
  Ready = False
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.setTimeouts 500, 500, 500, 1500
  http.Open "GET", url & "api/defaults", False
  http.Send
  If Err.Number = 0 And http.Status = 200 Then Ready = True
  On Error GoTo 0
End Function
