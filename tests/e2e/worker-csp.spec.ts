// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('production responses enforce worker CSP and per-document script hashes', async ({ request }) => {
  test.skip(process.env.E2E_PRODUCTION !== '1', 'Requires the production preview server.');
  const policy = readFileSync('public/_headers', 'utf8').match(/Content-Security-Policy: ([^\n]+)/)![1]!;
  for (const path of ['/vendor/pdfjs/pdf.worker.min.mjs', '/vendor/tesseract/worker.min.js']) {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-security-policy']).toBe(`frame-ancestors 'none', ${policy}`);
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
  }
  const document = await request.get('/');
  expect(document.headers()['content-security-policy']).toBe("frame-ancestors 'none'");
  expect(await document.text()).toContain('data-docredact-csp="true"');
});
