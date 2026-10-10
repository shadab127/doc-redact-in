// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { test, expect } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { isAllowedRedactionRequest } from './helpers/privacy';

const directory = process.env.LOCAL_SAMPLE_DIR;
const enabled = process.env.RUN_LOCAL_SAMPLES === '1' && !!directory;
const samples = enabled ? readdirSync(directory!).filter((name) => /\.(pdf|png|jpe?g|webp)$/i.test(name)).sort() : [];

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

if (!enabled) {
  test('local document regression requires explicit opt-in and a sample directory', () => {
    test.skip(true, 'Set RUN_LOCAL_SAMPLES=1 and LOCAL_SAMPLE_DIR to a private local directory.');
  });
} else {
  test('local regression directory contains supported samples', () => {
    expect(samples.length).toBeGreaterThan(0);
  });
}

for (const name of samples) {
  test(`local sample: ${name} detects, reviews and downloads`, async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    const unexpected: string[] = [];
    context.on('request', (request) => {
      if (!isAllowedRedactionRequest(request, new URL(baseURL!).origin)) {
        const url = new URL(request.url());
        unexpected.push(`${request.method()} ${url.origin} ${url.pathname}`);
      }
    });
    await page.goto('/mask-aadhaar-online/');
    await page.getByTestId('dropzone-input').setInputFiles(join(directory!, name));
    await page.getByText(/Found \d+ detection/).or(page.getByTestId('error-details')).first().waitFor({
      state: 'visible', timeout: 160_000,
    });
    if (await page.getByTestId('error-details').count()) {
      throw new Error(`Local sample processing failed: ${name}. Details are withheld to avoid recording document data.`);
    }
    await expect(page.getByTestId('redaction-preview')).toBeVisible();
    const pageCount = await page.getByText(/Found \d+ detection/).evaluate((element) => {
      const match = element.textContent?.match(/across (\d+) page/);
      return Number(match?.[1] ?? 0);
    });
    expect(pageCount).toBeGreaterThan(0);
    const aadhaar = await page.locator('li').filter({ hasText: 'Aadhaar number (mask first 8 digits)' }).count();
    const detections = await page.locator('input[data-testid^="toggle-"]').count();
    if (pageCount > 1) {
      const next = page.getByRole('button', { name: /Next/i });
      for (let i = 1; i < pageCount; i++) {
        await next.click();
        await expect(page.getByTestId('redaction-preview')).toBeVisible();
      }
    }
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('redactor-download-btn').click(),
    ]);
    const stream = await download.createReadStream();
    if (!stream) throw new Error('Download stream unavailable');
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    const output = await PDFDocument.load(bytes);
    expect(output.getPageCount()).toBe(pageCount);
    expect(unexpected).toEqual([]);
    console.log(JSON.stringify({ sample: name, pages: pageCount, detections, aadhaar, outputBytes: bytes.length }));
  });
}
