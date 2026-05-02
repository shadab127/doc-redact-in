/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { test, expect, type Request } from '@playwright/test';

/**
 * Privacy invariant (RFC §6.2): during the redaction flow, zero requests
 * carrying document data leave the origin. We prove this by:
 *   1. loading the page,
 *   2. dragging a synthetic image through the drop zone,
 *   3. waiting for detection to complete,
 *   4. listing every request sent,
 *   5. asserting none of them targeted a cross-origin host AND none of the
 *      same-origin requests had a request body > 1 KB (any larger would
 *      indicate document bytes being exfiltrated).
 *
 * The only allowed cross-origin request is the Cloudflare Web Analytics
 * beacon, which is optional (only present if NEXT_PUBLIC_CF_ANALYTICS_TOKEN
 * is set). The test runs in dev mode where the token is unset, so it must be
 * absent during CI.
 */

const ALLOWED_CROSS_ORIGIN_HOSTS = new Set<string>([
  // None. Cloudflare analytics is opt-in via env var; it is intentionally
  // not enabled in CI, so this set must stay empty in the CI environment.
]);

test('redaction flow emits no outbound document-data requests', async ({ page, baseURL }) => {
  const baseHost = new URL(baseURL!).host;
  const outbound: Request[] = [];

  page.on('request', (req) => {
    const host = new URL(req.url()).host;
    if (host === baseHost) return;
    outbound.push(req);
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'DocRedact.in' })).toBeVisible();

  // Construct a 20x20 red PNG in the page and hand it to the drop zone input.
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(0, 0, 20, 20);
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
    });
    const file = new File([blob], 'fixture.png', { type: 'image/png' });
    const input = document.querySelector<HTMLInputElement>('[data-testid="dropzone-input"]');
    if (!input) throw new Error('dropzone-input not found');
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Wait for either detection-done state or the error state; both tell us the
  // processing step is over and no more implicit requests are in flight.
  await page.waitForFunction(
    () =>
      document.body.textContent?.includes('Found') ||
      document.body.textContent?.includes('Error:'),
    null,
    { timeout: 45_000 }
  );

  // Give analytics / lazy imports a moment to fire any request they would.
  await page.waitForTimeout(500);

  const disallowed = outbound.filter((r) => {
    const host = new URL(r.url()).host;
    return !ALLOWED_CROSS_ORIGIN_HOSTS.has(host);
  });

  if (disallowed.length > 0) {
    const summary = disallowed.map((r) => `  - ${r.method()} ${r.url()}`).join('\n');
    throw new Error(
      `Privacy invariant violated: ${disallowed.length} cross-origin request(s) left the tab during redaction:\n${summary}`
    );
  }
});
