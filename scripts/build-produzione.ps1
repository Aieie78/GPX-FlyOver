$ErrorActionPreference = 'Stop'

function Stop-EMostraErrore {
    param([string]$Messaggio)
    Write-Host "`n$Messaggio" -ForegroundColor Red
    Read-Host 'Premi INVIO per chiudere'
    exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Stop-EMostraErrore 'npm non trovato nel PATH. Installa Node.js da https://nodejs.org e riprova.'
}

$appDir = Join-Path $PSScriptRoot '..\gpx-flyover-app'
if (-not (Test-Path $appDir)) {
    Stop-EMostraErrore "Cartella progetto non trovata: $appDir"
}
Set-Location $appDir

if (-not (Test-Path 'node_modules')) {
    Write-Host 'node_modules mancante: eseguo npm install...' -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Stop-EMostraErrore 'npm install fallito, controlla gli errori sopra.'
    }
}

Write-Host "`nBuild di produzione (npm run build)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Stop-EMostraErrore 'Build fallita, controlla gli errori sopra.'
}

Write-Host "`Avvio l'anteprima locale della build (vite preview): il browser si apre automaticamente." -ForegroundColor Cyan
Write-Host "Chiudi questa finestra per fermare il server.`n" -ForegroundColor DarkGray

npm run preview -- --open
