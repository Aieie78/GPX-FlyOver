@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-produzione.ps1"
if %errorlevel% neq 0 (
    echo.
    echo ATTENZIONE: lo script e' terminato con un errore ^(codice %errorlevel%^).
    echo Scorri in alto in questa finestra per leggere il messaggio di errore completo.
)
echo.
pause
endlocal
