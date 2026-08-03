$ErrorActionPreference = 'Stop'

# Server statico a dipendenza zero per la cartella "app" accanto a questo script, in PowerShell
# puro (nessun interprete esterno da eseguire) - alternativa a serve-standalone.cjs per i PC dove
# l'esecuzione di Node.js (anche portable) e' bloccata da una whitelist applicativa aziendale.
# Ascolta solo su "localhost" (non su 0.0.0.0/+): questo prefisso non richiede diritti di
# amministratore ne' una regola urlacl su Windows, a differenza di un listener su tutte le interfacce.

$ROOT = Join-Path $PSScriptRoot 'app'
$START_PORT = 5175
$MAX_ATTEMPTS = 10

$MIME = @{
    '.html'  = 'text/html; charset=utf-8'
    '.js'    = 'text/javascript; charset=utf-8'
    '.mjs'   = 'text/javascript; charset=utf-8'
    '.css'   = 'text/css; charset=utf-8'
    '.json'  = 'application/json; charset=utf-8'
    '.svg'   = 'image/svg+xml'
    '.png'   = 'image/png'
    '.jpg'   = 'image/jpeg'
    '.jpeg'  = 'image/jpeg'
    '.ico'   = 'image/x-icon'
    '.woff'  = 'font/woff'
    '.woff2' = 'font/woff2'
    '.webm'  = 'video/webm'
    '.wasm'  = 'application/wasm'
}

if (-not [System.IO.Directory]::Exists($ROOT)) {
    Write-Host "Cartella 'app' non trovata accanto a questo script: $ROOT" -ForegroundColor Red
    Write-Host 'Il pacchetto portatile e'' incompleto - rigeneralo con build-produzione.' -ForegroundColor Red
    Read-Host 'Premi INVIO per chiudere'
    exit 1
}

$ROOT_FULL = [System.IO.Path]::GetFullPath($ROOT)
$ROOT_PREFIX = $ROOT_FULL.TrimEnd('\') + '\'

function Send-Response {
    param($Response, [int]$StatusCode, [byte[]]$Bytes, [string]$ContentType)
    $Response.StatusCode = $StatusCode
    if ($ContentType) { $Response.ContentType = $ContentType }
    $Response.ContentLength64 = $Bytes.Length
    if ($Bytes.Length -gt 0) {
        $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
    }
    $Response.Close()
}

function Invoke-GpxRequest {
    param($Context)
    $request = $Context.Request
    $response = $Context.Response
    try {
        $urlPath = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
        if ($urlPath -eq '/') { $urlPath = '/index.html' }

        $relative = $urlPath.TrimStart('/')
        $filePath = [System.IO.Path]::GetFullPath((Join-Path $ROOT_FULL $relative))

        # Nessun accesso fuori dalla cartella "app" (path traversal).
        if ($filePath -ne $ROOT_FULL.TrimEnd('\') -and -not $filePath.StartsWith($ROOT_PREFIX, [System.StringComparison]::OrdinalIgnoreCase)) {
            Send-Response $response 403 ([System.Text.Encoding]::UTF8.GetBytes('Forbidden')) 'text/plain; charset=utf-8'
            return
        }

        if ([System.IO.File]::Exists($filePath)) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
            $contentType = $MIME[$ext]
            if (-not $contentType) { $contentType = 'application/octet-stream' }
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            Send-Response $response 200 $bytes $contentType
            return
        }

        # Fallback SPA: un percorso senza estensione (navigazione da router client-side, es.
        # /progetti/123) serve comunque index.html. Una richiesta con estensione riconoscibile
        # (asset statico, es. /assets/maplibre-gl-worker.mjs) o sotto /assets/ e' invece un 404
        # reale: NON va mai riscritta a index.html, altrimenti il browser riceve una risposta
        # 200 text/html al posto del file richiesto (es. "non-JavaScript MIME type" su un .mjs).
        $isStaticAssetRequest = $urlPath.StartsWith('/assets/') -or ([System.IO.Path]::GetExtension($urlPath) -ne '')
        if ($isStaticAssetRequest) {
            Send-Response $response 404 ([System.Text.Encoding]::UTF8.GetBytes('Not found')) 'text/plain; charset=utf-8'
            return
        }

        $indexPath = Join-Path $ROOT_FULL 'index.html'
        if ([System.IO.File]::Exists($indexPath)) {
            $bytes = [System.IO.File]::ReadAllBytes($indexPath)
            Send-Response $response 200 $bytes $MIME['.html']
        } else {
            Send-Response $response 404 ([System.Text.Encoding]::UTF8.GetBytes('Not found')) 'text/plain; charset=utf-8'
        }
    } catch {
        try {
            Send-Response $response 500 ([System.Text.Encoding]::UTF8.GetBytes('Internal error')) 'text/plain; charset=utf-8'
        } catch {}
    }
}

function Start-GpxListener {
    param([int]$Port, [int]$AttemptsLeft)

    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$Port/")
    try {
        $listener.Start()
        return @{ Listener = $listener; Port = $Port }
    } catch {
        if ($AttemptsLeft -gt 0) {
            return Start-GpxListener -Port ($Port + 1) -AttemptsLeft ($AttemptsLeft - 1)
        }
        Write-Host "Impossibile avviare il server: $($_.Exception.Message)" -ForegroundColor Red
        Read-Host 'Premi INVIO per chiudere'
        exit 1
    }
}

$started = Start-GpxListener -Port $START_PORT -AttemptsLeft $MAX_ATTEMPTS
$listener = $started.Listener
$url = "http://localhost:$($started.Port)"

Write-Host "GPX Flyover in esecuzione su $url"
Write-Host 'Chiudi questa finestra per fermare il programma.'

try {
    Start-Process $url | Out-Null
} catch {
    Write-Host "Impossibile aprire automaticamente il browser: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "Apri manualmente $url nel browser." -ForegroundColor Yellow
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        Invoke-GpxRequest -Context $context
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
