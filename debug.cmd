@echo off
cd /d "%~dp0"
title LoL Matchup Viewer - Debug

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies for the first run...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

echo Starting LoL Matchup Viewer in debug mode...
echo Keep this window open. Press Ctrl+C to stop.
call npm run dev
pause
