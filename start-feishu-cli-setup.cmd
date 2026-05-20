@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is missing. Trying to install Node.js LTS with winget...
  where winget >nul 2>nul
  if errorlevel 1 (
    echo winget is not available. Opening Node.js download page.
    start "" "https://nodejs.org/"
    pause
    exit /b 1
  )
  winget install --id OpenJS.NodeJS.LTS --exact --accept-source-agreements --accept-package-agreements
  set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%PATH%"
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm is missing. Please install Node.js LTS with npm, then run this launcher again.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo Installing setup window dependencies...
  npm install
  if errorlevel 1 exit /b %ERRORLEVEL%
)

npm start
exit /b %ERRORLEVEL%
