@echo off
chcp 65001 >nul
title Open Emulator - Tunel HTTPS para Lenovo Tab 11
cd /d "%~dp0"

echo ============================================================
echo   OPEN EMULATOR - Acceso HTTPS para tu Lenovo Tab 11
echo ============================================================
echo.
echo 1) Limpiando instancias anteriores y arrancando servidor en puerto 8080...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'python*' -and $_.CommandLine -like '*server.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
timeout /t 1 /nobreak >nul
start "Open Emulator Server" /min python server.py
timeout /t 2 /nobreak >nul

echo 2) Abriendo tunel HTTPS seguro (funciona desde cualquier Wi-Fi)...
echo    Copia la direccion https://... que aparecera abajo
echo    y abrela en Chrome en tu Lenovo Tab 11.
echo.
echo    (Mantener esta ventana abierta mientras juegas)
echo ============================================================
echo.

ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -R 80:127.0.0.1:8080 nokey@localhost.run

pause
