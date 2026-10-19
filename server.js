/**
 * WTT Arena Pro - local development server
 *
 *   npm run serve        # http://localhost:3000
 *
 * Uses only Node.js built-ins. The game is a static file; online play is
 * peer-to-peer through WebRTC, so no relay/backend is required.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const START_PORT = Number(process.env.PORT) || 3000;

// Whitelist the files that make up the app. This removes path traversal and
// prevents accidentally exposing .git, node_modules, source files, etc.
const PUBLIC_FILES = new Set([
  'index.html',
  'icon.svg',
  'manifest.webmanifest'
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.webmanifest': 'application/manifest+json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function sendText(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=UTF-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function serveFile(req, res, fileName) {
  const filePath = path.join(ROOT, fileName);
  const ext = path.extname(filePath).toLowerCase();

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      sendText(res, 404, 'Not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) sendText(res, 500, 'Could not read file');
      else res.destroy();
    });
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    sendText(res, 405, 'Method not allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (_) {
    sendText(res, 400, 'Bad request');
    return;
  }

  if (pathname === '/' || pathname === '') {
    serveFile(req, res, 'index.html');
    return;
  }

  const fileName = pathname.replace(/^\/+/, '');
  if (!PUBLIC_FILES.has(fileName)) {
    sendText(res, 404, 'Not found');
    return;
  }

  serveFile(req, res, fileName);
});

let currentPort = START_PORT;

function printAddresses(port) {
  console.log('\n======================================================');
  console.log('🏓  WTT Arena Pro local server');
  console.log(`👉  Local:   http://localhost:${port}`);
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) {
        console.log(`👉  Network: http://${address.address}:${port}`);
      }
    }
  }
  console.log('======================================================\n');
}

function startServer(port) {
  server.listen(port, () => printAddresses(port));
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`⚠️  Port ${currentPort} is in use, trying port ${currentPort + 1}...`);
    currentPort += 1;
    setTimeout(() => startServer(currentPort), 150);
  } else {
    console.error('Server error:', err);
    process.exitCode = 1;
  }
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

startServer(currentPort);
