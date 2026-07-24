@echo off
setlocal EnableExtensions
title Update and Build BCEP Content Studio
cd /d "%~dp0"

echo ============================================================
echo  BCEP Content Studio - Update and Build
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Install the current Node.js LTS release from https://nodejs.org/
  echo Then run this file again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Repair or reinstall Node.js LTS.
  echo.
  pause
  exit /b 1
)

echo [1 of 3] Updating application dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo Dependency update failed. The existing source files were not deleted.
  pause
  exit /b 1
)

echo.
echo [2 of 3] Running safety checks...
call npm test
if errorlevel 1 (
  echo.
  echo Tests failed. No Windows installer was created.
  pause
  exit /b 1
)

echo.
echo [3 of 3] Building the Windows installer and portable app...
call npm run dist:win
if errorlevel 1 (
  echo.
  echo Windows build failed. Review the error above.
  pause
  exit /b 1
)

for /f "usebackq delims=" %%V in (`node -p "require('./package.json').version"`) do set "BCEP_VERSION=%%V"

echo.
echo ============================================================
echo  BCEP Content Studio v%BCEP_VERSION% is ready.
echo ============================================================
echo.
echo The release folder will open now.
echo Close the currently running BCEP Content Studio before
echo running the new installer.
echo.
start "" "%~dp0release"
pause
