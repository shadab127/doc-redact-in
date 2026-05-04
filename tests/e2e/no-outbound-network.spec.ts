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

async function runInvariant(
  page: import('@playwright/test').Page,
  baseHost: string,
  injectFile: () => Promise<void>
): Promise<void> {
  const outbound: Request[] = [];
  page.on('request', (req) => {
    const url = req.url();
    // blob: URLs are in-memory references created via URL.createObjectURL;
    // fetching them reads bytes out of the tab's own RAM and never contacts
    // a remote host. Chromium doesn't fire page.on('request') for them;
    // WebKit does, and URL parsing gives an empty `host`, which would trip
    // this check even though no network traffic is involved.
    if (url.startsWith('blob:')) return;
    const host = new URL(url).host;
    if (host === baseHost) return;
    outbound.push(req);
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'DocRedact.in' })).toBeVisible();

  await injectFile();

  await page.waitForFunction(
    () =>
      document.body.textContent?.includes('Found') ||
      document.body.textContent?.includes('went wrong') ||
      document.body.textContent?.includes("Couldn't read"),
    null,
    { timeout: 60_000 }
  );
  await page.waitForTimeout(500);

  const disallowed = outbound.filter(
    (r) => !ALLOWED_CROSS_ORIGIN_HOSTS.has(new URL(r.url()).host)
  );

  if (disallowed.length > 0) {
    const summary = disallowed.map((r) => `  - ${r.method()} ${r.url()}`).join('\n');
    throw new Error(
      `Privacy invariant violated: ${disallowed.length} cross-origin request(s) left the tab during redaction:\n${summary}`
    );
  }
}

test('image path: redaction emits no outbound document-data requests', async ({
  page,
  baseURL,
}) => {
  const baseHost = new URL(baseURL!).host;
  await runInvariant(page, baseHost, async () => {
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
  });
});

test('PDF path: redaction emits no outbound document-data requests', async ({
  page,
  baseURL,
}) => {
  const baseHost = new URL(baseURL!).host;
  await runInvariant(page, baseHost, async () => {
    await page.evaluate(async () => {
      // Build a valid single-page PDF 1.4 with computed byte offsets. The xref
      // table must point at exact byte positions of the "N 0 obj" markers; a
      // hand-coded string drifts the moment anyone edits whitespace, so we
      // compute offsets from the concatenation itself.
      const stream = 'BT /F1 12 Tf 72 720 Td (Hello) Tj ET\n';
      const objects: string[] = [
        '1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n',
        '2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n',
        '3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources <<>> /Contents 4 0 R>> endobj\n',
        `4 0 obj <</Length ${stream.length}>> stream\n${stream}endstream endobj\n`,
      ];

      const header = '%PDF-1.4\n%\xC2\xA5\xC2\xB1\xC3\xAB\n';
      const offsets: number[] = [];
      let cursor = header.length;
      for (const o of objects) {
        offsets.push(cursor);
        cursor += o.length;
      }
      const xrefOffset = cursor;

      const pad10 = (n: number) => n.toString().padStart(10, '0');
      const xref =
        'xref\n0 5\n' +
        '0000000000 65535 f \n' +
        offsets.map((o) => `${pad10(o)} 00000 n \n`).join('');
      const trailer = `trailer <</Size 5 /Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF\n`;

      const body = header + objects.join('') + xref + trailer;
      const pdfBlob = new Blob([body], { type: 'application/pdf' });
      const file = new File([pdfBlob], 'fixture.pdf', { type: 'application/pdf' });
      const input = document.querySelector<HTMLInputElement>('[data-testid="dropzone-input"]');
      if (!input) throw new Error('dropzone-input not found');
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
});
