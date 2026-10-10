// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { isAllowedRedactionRequest, redactionAssetPaths } from './helpers/privacy';

test.skip(process.env.E2E_PRODUCTION !== '1', 'Privacy assertions require the production export; Next.js development diagnostics send POST requests.');

function watchRequests(context: BrowserContext, baseURL: string) {
  const violations: string[] = [];
  context.on('request', (request) => {
    if (!isAllowedRedactionRequest(request, new URL(baseURL).origin, redactionAssetPaths())) {
      const url = new URL(request.url());
      violations.push(`${request.method()} ${url.origin} ${url.pathname}`);
    }
  });
  return violations;
}

async function assertDownload(page: Page, button: import('@playwright/test').Locator) {
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
  expect(download.suggestedFilename()).toMatch(/_redacted\.pdf$/);
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Download stream unavailable');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).subarray(0, 5).toString()).toBe('%PDF-');
}

test('image detection and repeated export use only allowed same-origin asset requests', async ({ page, context, baseURL }) => {
  const violations = watchRequests(context, baseURL!);
  await page.goto('/mask-aadhaar-online/');
  await page.getByTestId('try-sample-btn').click();
  await expect(page.getByText(/Found [1-9]\d* detection/)).toBeVisible({ timeout: 60_000 });
  await assertDownload(page, page.getByTestId('redactor-download-btn'));
  await page.locator('input[data-testid^="toggle-"]:checked').first().uncheck();
  await assertDownload(page, page.getByTestId('redactor-download-btn'));
  expect(violations).toEqual([]);
});

test('PDF detection and export use only allowed same-origin asset requests', async ({ page, context, baseURL }) => {
  const violations = watchRequests(context, baseURL!);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([400, 300]).drawText('Synthetic document', { x: 20, y: 150, size: 20, font });
  const buffer = Buffer.from(await pdf.save());
  await page.goto('/');
  await page.getByTestId('dropzone-input').setInputFiles({ name: 'fixture.pdf', mimeType: 'application/pdf', buffer });
  await expect(page.getByText(/Found \d+ detection/)).toBeVisible({ timeout: 60_000 });
  await assertDownload(page, page.getByTestId('redactor-download-btn'));
  expect(violations).toEqual([]);
});

test('manual handoff, editing and export use only allowed same-origin asset requests', async ({ page, context, baseURL }) => {
  const violations = watchRequests(context, baseURL!);
  await page.goto('/');
  await page.getByTestId('try-sample-btn').click();
  await expect(page.getByText(/Found [1-9]\d* detection/)).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('open-manual-mode-btn').click();
  const canvas = page.getByTestId('manual-redact-canvas');
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Manual canvas unavailable');
  await page.mouse.move(bounds.x + 20, bounds.y + 60);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 140, bounds.y + 110, { steps: 5 });
  await page.mouse.up();
  await assertDownload(page, page.getByTestId('manual-export-btn'));
  await page.getByTestId('manual-delete-btn').click();
  await assertDownload(page, page.getByTestId('manual-export-btn'));
  expect(violations).toEqual([]);
});
