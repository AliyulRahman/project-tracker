@echo off
title DevTracker
cd /d "%~dp0"

echo.
echo  =========================================
echo    DevTracker
echo  =========================================
echo.

REM Prefer bundled node.exe; fall back to system Node.js
if exist "%~dp0node.exe" (
    set "NODEEXE=%~dp0node.exe"
) else (
    where node >nul 2>&1
    if errorlevel 1 (
        echo  ERROR: Node.js not found.
        echo  Please place node.exe in this folder or install Node.js.
        echo.
        pause
        exit /b 1
    )
    set "NODEEXE=node"
)

if not exist ".env" (
    echo  ERROR: .env file not found.
    echo  Please create a .env file with your database connection settings.
    echo.
    echo  Example .env contents:
    echo    DB_SERVER=AZUKDSQL03
    echo    DB_NAME=AI_Dev
    echo    DB_DRIVER=ODBC Driver 17 for SQL Server
    echo    APP_PORT=3000
    echo.
    pause
    exit /b 1
)

echo  Starting server — please wait a few seconds...
echo.

REM Open browser after 4-second delay (minimised helper window)
START /MIN "" cmd /c "timeout /t 4 /nobreak > nul && start http://localhost:3000"

REM Run the server in the foreground so logs are visible here
"%NODEEXE%" server.js

echo.
echo  Server stopped.
pause
