// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { describe, expect, it } from 'vitest';
import { isAllowedRedactionRequest } from '../e2e/helpers/privacy';

const origin = 'http://localhost:3100';
const assets = new Set(['/vendor/core.wasm', '/samples/sample-aadhaar.svg', '/_next/static/chunks/app.js']);
function request(path: string, method = 'GET', body: Buffer | null = null) {
  return { url: () => new URL(path, origin).href, method: () => method, postDataBuffer: () => body };
}

describe('redaction request allowlist', () => {
  it.each(['/vendor/core.wasm', '/samples/sample-aadhaar.svg', '/_next/static/chunks/app.js', '/manual/?_rsc=abc123', '/manual/index.txt', '/how-it-works/index.txt?_rsc=1p-R_iEY6bj0jY31'])('permits a static software request: %s', (path) => {
    expect(isAllowedRedactionRequest(request(path), origin, assets)).toBe(true);
  });

  it.each([
    request('/vendor/synthetic-document-secret'),
    request('/samples/synthetic-person-name.png'),
    request('/_next/static/chunks/synthetic-document.js'),
    request('/schema/synthetic-document.json'),
    request('/manual/.txt'),
    request('/manual/index.txt/'),
    request('/vendor/core.wasm', 'GET', Buffer.from('document')),
    request('/api/upload', 'POST', Buffer.from('document')),
    request('/vendor/core.wasm', 'POST', Buffer.from('document')),
    request('/api/upload?text=document'),
    request('/vendor/core.wasm?text=document'),
    request('/?filename=document.pdf'),
    request('/manual/index.txt?_rsc=abc&document=private'),
    request('/manual/index.txt?_rsc=' + 'a'.repeat(33)),
    request('https://example.com/upload', 'POST', Buffer.from('document')),
    request('https://cloudflareinsights.com/cdn-cgi/rum', 'POST', Buffer.from('document')),
  ])('rejects uploads, document-bearing queries and cross-origin requests', (req) => {
    expect(isAllowedRedactionRequest(req, origin, assets)).toBe(false);
  });
});
