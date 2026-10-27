@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap.ps1"
if errorlevel 1 goto failed
echo Setup finished. Edit .env, connect your phone, and run 실행.bat.
pause
exit /b 0
:failed
echo [ERROR] Setup failed. Check the message above.
pause
exit /b 1
