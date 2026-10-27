@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "FIRSTSTEP_PWSH="
if exist "%~dp0.tools\pwsh7\pwsh.exe" set "FIRSTSTEP_PWSH=%~dp0.tools\pwsh7\pwsh.exe"
if defined FIRSTSTEP_PWSH goto launch
if exist "%ProgramFiles%\PowerShell\7\pwsh.exe" set "FIRSTSTEP_PWSH=%ProgramFiles%\PowerShell\7\pwsh.exe"
if defined FIRSTSTEP_PWSH goto launch
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe" set "FIRSTSTEP_PWSH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe"
if defined FIRSTSTEP_PWSH goto launch
for /f "delims=" %%I in ('where pwsh.exe 2^>nul') do if not defined FIRSTSTEP_PWSH set "FIRSTSTEP_PWSH=%%I"
if not defined FIRSTSTEP_PWSH goto failed
:launch
"%FIRSTSTEP_PWSH%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-phone.ps1" %*
if errorlevel 1 goto failed
exit /b 0
:failed
echo [ERROR] USB phone startup failed. Check the message above.
pause
exit /b 1
