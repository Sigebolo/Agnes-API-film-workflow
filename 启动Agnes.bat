@echo off
title Agnes AI Film Studio
echo.
echo  ========================================
echo     Agnes AI Film Studio - Starting...
echo  ========================================
echo.

cd /d "D:\mimo code\Agnesfilm"

:: Check node
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

:: Check node_modules
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    npm install
)

:: Start server and open browser
echo [INFO] Starting server on http://localhost:3000
echo [INFO] Press Ctrl+C to stop
echo.

start "" http://localhost:3000
npx tsx server.ts
