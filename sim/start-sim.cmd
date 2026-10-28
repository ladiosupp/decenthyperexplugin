@echo off
chcp 65001 >nul
set "SIMDIR=%~dp0"
set "PORT=4780"
netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul
if not errorlevel 1 goto open
echo Starting HyperEx sim on port %PORT% ...
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath node -ArgumentList '%SIMDIR%server.js' -WorkingDirectory '%SIMDIR%..' -WindowStyle Hidden"
ping -n 3 127.0.0.1 >nul
:open
echo.
echo   http://127.0.0.1:%PORT%/
echo.
start "" "http://127.0.0.1:%PORT%/"
exit /b 0

