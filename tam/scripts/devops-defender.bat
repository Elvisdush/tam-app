@echo off
:: TAM App DevOps Defender Management Script
:: This script provides easy access to Defender management for development

setlocal enabledelayedexpansion

title TAM App - DevOps Defender Management

:menu
cls
echo.
echo ================================================
echo   TAM App - DevOps Defender Management
echo ================================================
echo.
echo 1. Disable Microsoft Defender (Development Mode)
echo 2. Enable Microsoft Defender (Production Mode)
echo 3. Check Defender Status
echo 4. View Defender Configuration
echo 5. Quick Toggle (Disable/Enable)
echo 6. Exit
echo.
set /p choice="Select an option (1-6): "

if "%choice%"=="1" goto disable
if "%choice%"=="2" goto enable
if "%choice%"=="3" goto status
if "%choice%"=="4" goto config
if "%choice%"=="5" goto toggle
if "%choice%"=="6" goto exit

echo Invalid choice. Please try again.
pause
goto menu

:disable
echo.
echo [DISABLE] Disabling Microsoft Defender for development...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0disable-defender.ps1"
if %errorlevel% equ 0 (
    echo [SUCCESS] Microsoft Defender has been disabled for development
) else (
    echo [ERROR] Failed to disable Microsoft Defender
)
echo.
pause
goto menu

:enable
echo.
echo [ENABLE] Re-enabling Microsoft Defender for production...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0enable-defender.ps1"
if %errorlevel% equ 0 (
    echo [SUCCESS] Microsoft Defender has been re-enabled for production
) else (
    echo [ERROR] Failed to re-enable Microsoft Defender
)
echo.
pause
goto menu

:status
echo.
echo [STATUS] Checking Microsoft Defender status...
echo.
powershell -Command "Get-MpPreference | ConvertTo-Json"
echo.
pause
goto menu

:config
echo.
echo [CONFIG] Viewing Defender configuration...
echo.
if exist "%~dp0defender-config.json" (
    type "%~dp0defender-config.json"
) else (
    echo [ERROR] Defender configuration file not found
    echo Run option 1 first to create configuration
)
echo.
pause
goto menu

:toggle
echo.
echo [TOGGLE] Quick toggle Defender state...
echo.
powershell -Command "$status = Get-MpPreference; if ($status.DisableRealtimeMonitoring) { Write-Host 'Enabling Defender...'; .\scripts\enable-defender.ps1 } else { Write-Host 'Disabling Defender...'; .\scripts\disable-defender.ps1 }"
echo.
pause
goto menu

:exit
echo.
echo [EXIT] Exiting DevOps Defender Management...
echo.
echo Remember to re-enable Defender if it's currently disabled!
echo.
timeout /t 3 >nul
exit /b 0
