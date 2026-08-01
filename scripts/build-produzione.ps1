$ErrorActionPreference = 'Stop'

function Stop-EMostraErrore {
    param([string]$Messaggio)
    Write-Host "`n$Messaggio" -ForegroundColor Red
    Read-Host 'Premi INVIO per chiudere'
    exit 1
}

try {
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

    # MapLibre calcola l'URL del proprio worker in runtime come percorso relativo al chunk in cui si
    # trova (new URL('./maplibre-gl-worker.mjs', import.meta.url)), ma "vite build" non lo include mai
    # tra gli asset emessi: i file esistono solo dentro node_modules/maplibre-gl/dist/. Il worker a
    # sua volta importa maplibre-gl-shared.mjs con lo stesso meccanismo, quindi vanno copiati
    # entrambi — senza, in produzione (sia "vite preview" che il pacchetto portatile) la richiesta
    # di uno dei due file risulta un 404 e la mappa resta bloccata (cartografia visibile ma i
    # pulsanti Anteprima/Registra non si abilitano mai, perché l'evento 'load' di MapLibre non
    # scatta).
    foreach ($workerFile in @('maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs')) {
        $workerSrc = Join-Path $appDir "node_modules\maplibre-gl\dist\$workerFile"
        if (-not (Test-Path $workerSrc)) {
            Stop-EMostraErrore "File di MapLibre non trovato: $workerSrc"
        }
        Copy-Item -Path $workerSrc -Destination (Join-Path $appDir "dist\assets\$workerFile") -Force
    }

    # Pacchetto portatile: la cartella "portable" contiene tutto il necessario per copiare il tool su
    # un altro PC e avviarlo con un doppio click, senza npm/npm install - basta Node.js installato
    # sul PC di destinazione (server statico a dipendenza zero, vedi portable-template/serve-standalone.cjs).
    Write-Host "`nPreparo il pacchetto portatile (portable\)..." -ForegroundColor Cyan
    $portableDir = Join-Path $appDir 'portable'
    $portableAppDir = Join-Path $portableDir 'app'
    $templateDir = Join-Path $PSScriptRoot 'portable-template'

    if (Test-Path $portableDir) {
        try {
            Remove-Item $portableDir -Recurse -Force
        } catch {
            Stop-EMostraErrore "Impossibile cancellare la cartella 'portable' esistente (file in uso). Chiudi prima 'Avvia GPX Flyover.bat' o qualunque finestra del server portatile ancora aperta, poi riprova.`nDettaglio: $($_.Exception.Message)"
        }
    }
    New-Item -ItemType Directory -Path $portableAppDir -Force | Out-Null
    Copy-Item -Path (Join-Path $appDir 'dist\*') -Destination $portableAppDir -Recurse -Force
    Copy-Item -Path (Join-Path $templateDir '*') -Destination $portableDir -Force

    # Un file .bat non può avere un'icona propria in Windows: creiamo un collegamento (.lnk) che
    # punta allo stesso .bat ma mostra l'icona del tool — è quello da usare per il doppio click.
    $shortcutPath = Join-Path $portableDir 'Avvia GPX Flyover.lnk'
    $wshShell = New-Object -ComObject WScript.Shell
    $shortcut = $wshShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = Join-Path $portableDir 'Avvia GPX Flyover.bat'
    $shortcut.WorkingDirectory = $portableDir
    $shortcut.IconLocation = Join-Path $portableDir 'icon.ico'
    $shortcut.Save()

    Write-Host "Pacchetto pronto: $portableDir" -ForegroundColor Green
    Write-Host "Per portare il tool su un altro PC: copia l'intera cartella 'portable' (rinominala come" -ForegroundColor Green
    Write-Host "preferisci) e lancia 'Avvia GPX Flyover.lnk' (icona del tool) - serve solo Node.js installato, nient'altro.`n" -ForegroundColor Green

    Write-Host "Avvio l'anteprima locale della build (vite preview): il browser si apre automaticamente." -ForegroundColor Cyan
    Write-Host "Chiudi questa finestra per fermare il server.`n" -ForegroundColor DarkGray

    npm run preview -- --open
} catch {
    Stop-EMostraErrore "Errore imprevisto: $($_.Exception.Message)"
}
