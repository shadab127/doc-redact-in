// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { headersForPath } = await import(pathToFileURL(resolve('scripts/preview-headers.mjs')).href);
const { buildHeaders } = await import(pathToFileURL(resolve('scripts/csp-hashes.mjs')).href);
const template = readFileSync('public/_headers', 'utf8');
const policy = template.match(/Content-Security-Policy: ([^\n]+)/)![1]!;
const headers = buildHeaders(template, policy);

it.each(['/vendor/pdfjs/pdf.worker.min.mjs', '/vendor/tesseract/worker.min.js', '/_next/static/chunks/worker.js'])('merges worker policy with global headers: %s', (path) => {
  const effective = headersForPath(headers, path);
  expect(effective['content-security-policy']).toBe(`frame-ancestors 'none', ${policy}`);
  expect(effective['x-content-type-options']).toBe('nosniff');
  expect(effective['cache-control']).toContain('public, max-age=');
});

it.each(['/', '/manual/', '/vendor-other/worker.js', '/samples/sample-aadhaar.svg'])('does not apply asset rules to other paths: %s', (path) => {
  const effective = headersForPath(headers, path);
  expect(effective['content-security-policy']).toBe("frame-ancestors 'none'");
  expect(effective['cache-control']).toBeUndefined();
});

it('matches exact paths and combines duplicate headers case-insensitively in file order', () => {
  const source = '# synthetic\n/*\n  X-Test: global\n/exact.js\n  x-test: exact\n/vendor/*\n  X-Test: asset\n';
  expect(headersForPath(source, '/exact.js')['x-test']).toBe('global, exact');
  expect(headersForPath(source, '/exactXjs')['x-test']).toBe('global');
  expect(headersForPath(source, '/vendor/core.wasm')['x-test']).toBe('global, asset');
});
