@echo off
setlocal
chcp 65001 >nul
title One Step App on Phone
cd /d "%~dp0"
call "%~dp0휴대폰실행.bat" %*
exit /b %ERRORLEVEL%
