@echo off
cd /d "%~dp0"

set DIST_DIR=dist

echo ============================================
echo  DevTracker - Build Distribution Package
echo ============================================
echo.

:: Check node.exe exists
if not exist "node.exe" (
    echo WARNING: node.exe not found in project root.
    echo The dist will be created without it. You must copy node.exe manually.
    echo.
)

:: Check .env exists
if not exist ".env" (
    echo WARNING: .env file not found.
    echo The dist will be created without it. Target machine must configure .env manually.
    echo.
)

:: Clean up previous dist
if exist "%DIST_DIR%" rmdir /s /q "%DIST_DIR%"

echo Copying files to %DIST_DIR%\...

:: Copy everything except .git and dist itself; exclude dev-only files
:: Use full path for /XD so only the top-level dist folder is excluded (not node_modules/*/dist)
robocopy . "%DIST_DIR%" /E /XD ".git" "%~dp0%DIST_DIR%" /XF package.bat .gitignore .env.example /NFL /NDL /NJH /NJS > nul

echo.
echo Done! dist\ folder is ready to distribute.
echo.
echo On the target machine:
echo   1. Copy the dist folder to any location
echo   2. Ensure .env is present with correct DB settings
echo   3. Double-click start.bat to launch DevTracker
echo.
pause
