@echo off
title Stop Open LLM Orchestrator UI
cd /d "%~dp0"

echo Stopping Open LLM Orchestrator UI (ports 8002 and 5173)...
echo.

for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :8002 ^| findstr LISTENING') do (
  taskkill /PID %%a /F 2>nul && echo Stopped backend on port 8002 (PID %%a)
)

for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :5173 ^| findstr LISTENING') do (
  taskkill /PID %%a /F 2>nul && echo Stopped frontend on port 5173 (PID %%a)
)

echo.
echo Done.
pause
