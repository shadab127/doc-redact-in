// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

test('Aadhaar landing page offers the sample on mobile and preserves preview aspect ratio', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/mask-aadhaar-online/');
  await expect(page.getByTestId('try-sample-btn')).toBeVisible();
  await page.getByTestId('try-sample-btn').click();
  await expect(page.getByText(/Found [1-9]\d* detection/)).toBeVisible({ timeout: 60_000 });
  const preview = page.getByTestId('redaction-preview');
  const box = await preview.boundingBox();
  const dimensions = await preview.locator('canvas').first().evaluate((canvas: HTMLCanvasElement) => ({ width: canvas.width, height: canvas.height }));
  if (!box) throw new Error('Preview unavailable');
  expect(box.width / box.height).toBeCloseTo(dimensions.width / dimensions.height, 2);
  expect(box.width).toBeLessThanOrEqual(375);
});

test('Aadhaar selections are transparent, cover the first eight digits and leave the last four clear', async ({ page }) => {
  await page.goto('/mask-aadhaar-online/');
  await page.getByTestId('try-sample-btn').click();
  await expect(page.getByText(/Found [1-9]\d* detection/)).toBeVisible({ timeout: 60_000 });
  const overlay = page.getByTestId('redaction-preview').locator('canvas').nth(1);
  const alpha = () => overlay.evaluate((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')!;
    return { masked: ctx.getImageData(240, 326, 1, 1).data[3], visible: ctx.getImageData(470, 326, 1, 1).data[3] };
  });
  const selected = await alpha();
  expect(selected.masked).toBeGreaterThan(0);
  expect(selected.masked).toBeLessThan(255);
  expect(selected.visible).toBe(0);
  await page.locator('li').filter({ hasText: 'Aadhaar number (mask first 8 digits)' }).locator('input').uncheck();
  expect((await alpha()).masked).toBe(0);
});

for (const route of ['/', '/manual/']) {
  test(`${route} rejects oversized files before processing`, async ({ page }) => {
    await page.goto(route);
    await page.getByTestId('dropzone-input').setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(20 * 1024 * 1024 + 1) });
    await expect(page.getByText('File is too large. Choose a file up to 20 MB.', { exact: true })).toBeVisible();
    await expect(page.getByText(/Found \d+ detection/)).toHaveCount(0);
  });

  test(`${route} rejects excessive PDF pages`, async ({ page }) => {
    const pdf = await PDFDocument.create();
    for (let i = 0; i < 11; i++) pdf.addPage([100, 100]);
    await page.goto(route);
    await page.getByTestId('dropzone-input').setInputFiles({ name: 'pages.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
    await expect(page.getByText('This PDF has too many pages. Choose up to 10 pages.', { exact: true })).toBeVisible({ timeout: 30_000 });
  });

  test(`${route} rejects oversized PDF dimensions before rasterization`, async ({ page }) => {
    const pdf = await PDFDocument.create();
    pdf.addPage([4000, 4000]);
    await page.goto(route);
    await page.getByTestId('dropzone-input').setInputFiles({ name: 'dimensions.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
    await expect(page.getByText('This document needs too much memory. Use a smaller image or split the PDF into fewer pages.', { exact: true })).toBeVisible({ timeout: 30_000 });
  });
}

test('camera input uses the same byte limit', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.getByTestId('camera-capture-button')).toBeVisible();
  await page.getByTestId('camera-capture-input').setInputFiles({ name: 'large.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(20 * 1024 * 1024 + 1) });
  await expect(page.getByText('File is too large. Choose a file up to 20 MB.', { exact: true })).toBeVisible();
});

test('automatic export leaves the source unchanged when entering manual mode', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('try-sample-btn').click();
  await expect(page.getByText(/Found [1-9]\d* detection/)).toBeVisible({ timeout: 60_000 });
  const sourceBefore = await page.getByTestId('redaction-preview').locator('canvas').first().evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await Promise.all([page.waitForEvent('download'), page.getByTestId('redactor-download-btn').click()]);
  await page.getByTestId('open-manual-mode-btn').click();
  const sourceAfter = await page.getByTestId('manual-redact-canvas').locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  expect(sourceAfter).toBe(sourceBefore);
});
