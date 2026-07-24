@echo off
setlocal
title BCEP Content Studio Setup
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Install the current Node.js LTS release from https://nodejs.org/
  echo Then run this file again.
  pause
  exit /b 1
)

echo Installing BCEP Content Studio dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo Installation failed. Review the error above.
  pause
  exit /b 1
)

echo.
echo Starting BCEP Content Studio...
call npm start
