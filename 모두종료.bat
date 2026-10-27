@echo off
setlocal
chcp 65001 >nul
title Stop One Step Services
cd /d "%~dp0"
set "FIRSTSTEP_PWSH="
if exist "%~dp0.tools\pwsh7\pwsh.exe" set "FIRSTSTEP_PWSH=%~dp0.tools\pwsh7\pwsh.exe"
if defined FIRSTSTEP_PWSH goto run
if exist "%ProgramFiles%\PowerShell\7\pwsh.exe" set "FIRSTSTEP_PWSH=%ProgramFiles%\PowerShell\7\pwsh.exe"
if defined FIRSTSTEP_PWSH goto run
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe" set "FIRSTSTEP_PWSH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe"
if defined FIRSTSTEP_PWSH goto run
for /f "delims=" %%I in ('where pwsh.exe 2^>nul') do if not defined FIRSTSTEP_PWSH set "FIRSTSTEP_PWSH=%%I"
if not defined FIRSTSTEP_PWSH goto missing
:run
"%FIRSTSTEP_PWSH%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-services.ps1" -IncludePhoneApp
if errorlevel 1 goto failed
echo Project servers and connected phone app stopped.
pause
exit /b 0
:missing
echo PowerShell 7 was not found. Start the project once with 실행.bat, then retry.
pause
exit /b 1
:failed
echo Shutdown did not complete. Read the message above.
pause
exit /b 1
