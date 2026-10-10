/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */

// Local preview server that serves ./out/ with the production _headers
// applied, so what you hit at http://localhost:4321 is byte-for-byte and
// header-for-header what Cloudflare Pages will serve.
//
// Use this (not `next start`) when verifying the strict CSP, vendored WASM
// loads, or any behaviour that depends on production HTTP headers.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { headersForPath } from './preview-headers.mjs';

const ROOT = path.resolve('out');
const HEADERS_FILE = path.join(ROOT, '_headers');
const PORT = Number(process.env.PORT ?? 4321);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
  '.gz': 'application/gzip',
  '.bin': 'application/octet-stream',
};

const headersText = fs.readFileSync(HEADERS_FILE, 'utf8');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const headers = headersForPath(headersText, url.pathname);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  let fullPath = path.join(ROOT, pathname);
  if (!fullPath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (!fs.existsSync(fullPath)) {
    const alt = path.join(ROOT, pathname, 'index.html');
    if (fs.existsSync(alt)) fullPath = alt;
    else {
      res.writeHead(404, {
        'Content-Type': 'text/plain',
        ...headers,
      });
      res.end(`not found: ${pathname}`);
      return;
    }
  }
  const ext = path.extname(fullPath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    ...headers,
  });
  fs.createReadStream(fullPath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Preview server: http://localhost:${PORT}`);
  console.log(`Serving:        ${ROOT}`);
  console.log(`Applying headers from: ${HEADERS_FILE}`);
  console.log(`(This matches Cloudflare Pages' behaviour. Ctrl+C to stop.)`);
});
