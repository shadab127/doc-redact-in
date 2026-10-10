// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { test, expect } from '@playwright/test';

interface ExportProbe extends Window {
  pendingExport?: { canvas: HTMLCanvasElement; release: () => void };
}

for (const mode of ['automatic', 'manual']) {
  test(`Start over in the other mode cancels a pending ${mode} export`, async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('try-sample-btn').click();
    await page.getByText(/Found \d+ detection/).waitFor({ timeout: 60_000 });
    await page.getByTestId('open-manual-mode-btn').click();
    await expect(page.getByTestId('manual-export-btn')).toBeVisible();
    if (mode === 'automatic') await page.goBack();
    let downloads = 0;
    page.on('download', () => downloads++);
    await page.evaluate(() => {
      const original = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
        original.call(this, (blob) => {
          (window as ExportProbe).pendingExport = { canvas: this, release: () => callback(blob) };
        }, ...args);
      };
    });
    await page.getByTestId(mode === 'automatic' ? 'redactor-download-btn' : 'manual-export-btn').click();
    await page.waitForFunction(() => !!(window as ExportProbe).pendingExport);
    if (mode === 'automatic') {
      await page.goForward();
      await page.getByRole('button', { name: 'Start over', exact: true }).click();
    } else {
      await page.goBack();
      await page.getByTestId('redactor-start-over-btn').click();
    }
    await expect.poll(() => page.evaluate(() => {
      const canvas = (window as ExportProbe).pendingExport!.canvas;
      return [canvas.width, canvas.height];
    })).toEqual([0, 0]);
    await page.evaluate(async () => {
      (window as ExportProbe).pendingExport!.release();
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
    expect(downloads).toBe(0);
    await expect(page.getByTestId('error-details')).toHaveCount(0);
    await expect(page.getByTestId('dropzone-input')).toBeAttached();
    if (mode === 'automatic') await page.goBack();
    else await page.goForward();
    await expect(page.getByTestId('redaction-preview')).toHaveCount(0);
    await expect(page.getByTestId('manual-redact-canvas')).toHaveCount(0);
    await expect(page.getByTestId('error-details')).toHaveCount(0);
  });
}
