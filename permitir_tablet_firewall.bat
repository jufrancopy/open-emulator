@echo off
chcp 65001 >nul
title Open Emulator - Permitir conexion desde Lenovo Tab 11
echo ============================================================
echo   Configurando Windows Firewall para tu Lenovo Tab 11...
echo ============================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Solicitando permisos de Administrador...
    powershell -NoProfile -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

netsh advfirewall firewall delete rule name="Open Emulator (8080)" >nul 2>&1
netsh advfirewall firewall add rule name="Open Emulator (8080)" dir=in action=allow protocol=TCP localport=8080 profile=any

powershell -NoProfile -Command "try { Set-NetConnectionProfile -InterfaceAlias 'Ethernet 4' -NetworkCategory Private -ErrorAction Stop; Write-Host 'Red Ethernet 4 cambiada a Privada.' -ForegroundColor Green } catch { }"

echo.
echo ============================================================
echo   LISTO! Puerto 8080 abierto para tu Lenovo Tab 11.
echo   Asegurate de tener abierto iniciar_emulador.bat
echo   y entra en Chrome desde la tablet a:
echo   http://10.147.188.204:8080
echo ============================================================
echo.
pause
