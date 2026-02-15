@echo off
title Open LLM Orchestrator UI
cd /d "%~dp0"

echo Starting Open LLM Orchestrator UI...
echo.

echo Installing dependencies (npm install)...
call npm install
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)
echo.

echo Backend (thin API):  http://localhost:8002
echo Frontend (Vite):     http://localhost:5173
echo.
echo Open http://localhost:5173 in your browser.
echo Press Ctrl+C to stop.
echo.

npm run dev

pause
