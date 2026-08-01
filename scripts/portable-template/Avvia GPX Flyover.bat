@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js non trovato su questo PC.
  echo Installa Node.js ^(versione LTS^) da https://nodejs.org e riprova.
  echo.
  pause
  exit /b 1
)

node serve-standalone.cjs
pause
