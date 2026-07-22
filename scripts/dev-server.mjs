// Minimaler statischer Dateiserver ohne Abhängigkeiten (kein npm install
// nötig, nur Node-Bordmittel) – löst, dass normale Browser (Chrome/Edge)
// ES-Module (import/export) über file:// aus Sicherheitsgründen blockieren
// ("Cross origin requests are only supported for protocol schemes: http,
// https, ..."). Über http://localhost geöffnet funktioniert alles normal.
//
// Start: node scripts/dev-server.mjs
// Dann z.B. öffnen:
//   http://localhost:8420/src/manager/overview.html
//   http://localhost:8420/src/manager/index.html
//   http://localhost:8420/src/hiveball.html

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8420;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.join(ROOT, urlPath === '/' ? '/README.md' : urlPath);

  // Verhindert Zugriff außerhalb des Projektordners (z.B. über "..\" im Pfad).
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Verboten');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Nicht gefunden: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Hiveball Dev-Server läuft auf http://localhost:${PORT}/`);
  console.log(`  Übersicht:     http://localhost:${PORT}/src/manager/overview.html`);
  console.log(`  Kader:         http://localhost:${PORT}/src/manager/index.html`);
  console.log(`  Kernspiel:     http://localhost:${PORT}/src/hiveball.html`);
});
