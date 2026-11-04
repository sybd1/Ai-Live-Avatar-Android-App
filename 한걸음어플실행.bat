@echo off
setlocal
chcp 65001 >nul
title One Step App
cd /d "%~dp0"
call "%~dp0실행.bat" %*
exit /b %ERRORLEVEL%
