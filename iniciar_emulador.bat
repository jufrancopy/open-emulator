@echo off
chcp 65001 >nul
title Open Emulator - Servidor para Lenovo Tab 11
cd /d "%~dp0"
echo ============================================================
echo   OPEN EMULATOR - Servidor Local para Lenovo Tab 11
echo ============================================================
echo.
python server.py
pause
