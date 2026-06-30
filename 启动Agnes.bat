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
    call npm install
)

:: Build if needed
if not exist "dist\server.cjs" (
    echo [INFO] Building project...
    call npm run build
)

:: Kill existing node processes on port 3000
echo [INFO] Cleaning up...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul

:: Start server
echo [INFO] Starting server on http://localhost:3000
echo [INFO] Press Ctrl+C to stop
echo.

start "" http://localhost:3000
node dist/server.cjs
