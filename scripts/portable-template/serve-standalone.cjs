'use strict';
// Server statico a dipendenza zero per la cartella "app" accanto a questo script — usato dal
// pacchetto portatile (vedi build-produzione.ps1) per far girare la build su un PC che ha Node.js
// ma non necessariamente il progetto/npm install: nessun pacchetto da scaricare, solo Node.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT = path.join(__dirname, 'app');
const START_PORT = 5175;
const MAX_ATTEMPTS = 10;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
};

if (!fs.existsSync(ROOT)) {
  console.error(`Cartella "app" non trovata accanto a questo script: ${ROOT}`);
  console.error('Il pacchetto portatile è incompleto — rigeneralo con build-produzione.');
  process.exitCode = 1;
  return;
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath);

  // Nessun accesso fuori dalla cartella "app" (path traversal).
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Fallback SPA: un percorso senza estensione (navigazione da router client-side, es.
      // /progetti/123) serve comunque index.html. Una richiesta con estensione riconoscibile
      // (asset statico, es. /assets/maplibre-gl-worker.mjs) o sotto /assets/ è invece un 404
      // reale: NON va mai riscritta a index.html, altrimenti il browser riceve una risposta
      // 200 text/html al posto del file richiesto (es. "non-JavaScript MIME type" su un .mjs).
      const isStaticAssetRequest = urlPath.startsWith('/assets/') || path.extname(urlPath) !== '';
      if (isStaticAssetRequest) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      fs.readFile(path.join(ROOT, 'index.html'), (err2, indexData) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(indexData);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

function listen(port, attemptsLeft) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      listen(port + 1, attemptsLeft - 1);
    } else {
      console.error(`Impossibile avviare il server: ${err.message}`);
      process.exitCode = 1;
    }
  });
  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`GPX Flyover in esecuzione su ${url}`);
    console.log('Chiudi questa finestra per fermare il programma.');
    if (process.platform === 'win32') {
      exec(`start "" "${url}"`);
    }
  });
}

listen(START_PORT, MAX_ATTEMPTS);
