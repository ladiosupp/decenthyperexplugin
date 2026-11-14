' Create (or refresh) the desktop shortcut for the HyperEx sim launcher.
Option Explicit
Dim sh, fso, simDir, lnk
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
simDir = fso.GetParentFolderName(WScript.ScriptFullName)
Set lnk = sh.CreateShortcut(sh.SpecialFolders("Desktop") & "\HyperEx sim.lnk")
lnk.TargetPath = "wscript.exe"
lnk.Arguments = """" & simDir & "\launch-sim.vbs"""
lnk.WorkingDirectory = simDir
lnk.IconLocation = "%SystemRoot%\System32\shell32.dll, 13"
lnk.Description = "HyperEx offline sim: start server + open page"
lnk.Save
MsgBox "Desktop shortcut created: HyperEx sim", vbInformation, "HyperEx sim"
