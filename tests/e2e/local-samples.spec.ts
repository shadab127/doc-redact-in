// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { isAllowedRedactionRequest, redactionAssetPaths } from './helpers/privacy';

const directory = process.env.LOCAL_SAMPLE_DIR;
const enabled = process.env.RUN_LOCAL_SAMPLES === '1' && !!directory;
function sampleNames(): string[] {
  if (!enabled) return [];
  try {
    return readdirSync(directory!).filter((name) => /\.(pdf|png|jpe?g|webp)$/i.test(name)).sort();
  } catch {
    throw new Error('Private sample directory is unavailable; details withheld.');
  }
}
const samples = sampleNames();
const mimeTypes: Record<string, string> = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

if (!enabled) {
  test('local document regression requires explicit opt-in and a sample directory', () => {
    test.skip(true, 'Use npm run test:e2e:private with LOCAL_SAMPLE_DIR outside the repository.');
  });
} else {
  test('local regression directory contains supported samples', () => {
    expect(samples.length).toBeGreaterThan(0);
  });
}

for (const [index, name] of samples.entries()) {
  const sample = `sample-${String(index + 1).padStart(3, '0')}`;
  test(`private ${sample} detects, reviews and downloads`, async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    let stage = 'setup';
    try {
      const assets = redactionAssetPaths();
      const origin = new URL(baseURL!).origin;
      let unexpected = 0;
      context.on('request', (request) => {
        if (!isAllowedRedactionRequest(request, origin, assets)) unexpected++;
      });
      await context.route('**/*', (route) => isAllowedRedactionRequest(route.request(), origin, assets)
        ? route.continue() : route.abort());
      await page.goto('/mask-aadhaar-online/');
      stage = 'processing';
      const extension = extname(name).toLowerCase();
      await page.getByTestId('dropzone-input').setInputFiles({
        name: `${sample}${extension}`,
        mimeType: mimeTypes[extension]!,
        buffer: readFileSync(join(directory!, name)),
      });
      await page.getByText(/Found \d+ detection/).or(page.getByTestId('error-details')).first().waitFor({
        state: 'visible', timeout: 160_000,
      });
      if (await page.getByTestId('error-details').count()) throw new Error('processing_failed');
      stage = 'review';
      await expect(page.getByTestId('redaction-preview')).toBeVisible();
      const pageCount = await page.getByText(/Found \d+ detection/).evaluate((element) => {
        const match = element.textContent?.match(/across (\d+) page/);
        return Number(match?.[1] ?? 0);
      });
      expect(pageCount).toBeGreaterThan(0);
      const aadhaar = await page.locator('li').filter({ hasText: 'Aadhaar number (mask first 8 digits)' }).count();
      const detections = await page.locator('input[data-testid^="toggle-"]').count();
      const faces = await page.locator('li').filter({ hasText: 'Face photograph' }).count();
      const uidaiQr = await page.locator('li').filter({ hasText: 'UIDAI QR code' }).count();
      const otherQr = await page.locator('li').filter({ hasText: 'Other QR code' }).count();
      const uncertainMasks = await page.getByTestId('uncertain-mask-warning').count();
      for (let i = 1; i < pageCount; i++) {
        await page.getByRole('button', { name: /Next/i }).click();
        await expect(page.getByTestId('redaction-preview')).toBeVisible();
      }
      stage = 'export';
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('redactor-download-btn').click(),
      ]);
      try {
        const stream = await download.createReadStream();
        if (!stream) throw new Error('download_unavailable');
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.from(chunk));
        const bytes = Buffer.concat(chunks);
        expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
        const output = await PDFDocument.load(bytes);
        expect(output.getPageCount()).toBe(pageCount);
        expect(output.getTitle() === undefined).toBe(true);
        expect(output.getAuthor() === undefined).toBe(true);
        expect(output.catalog.has(PDFName.of('Names'))).toBe(false);
        for (const outputPage of output.getPages()) {
          expect(outputPage.node.Annots()?.size() ?? 0).toBe(0);
          const contents = outputPage.node.Contents();
          const streams = contents instanceof PDFArray
            ? contents.asArray().map((item) => output.context.lookup(item)) : [contents];
          expect(streams.length).toBeGreaterThan(0);
          for (const stream of streams) {
            if (!(stream instanceof PDFRawStream)) throw new Error('unexpected_output_stream');
            const commands = Buffer.from(decodePDFRawStream(stream).decode()).toString('ascii');
            expect(/\b(?:BT|ET|Tj|TJ)\b/.test(commands)).toBe(false);
            expect(/\bDo\b/.test(commands)).toBe(true);
          }
        }
        expect(unexpected).toBe(0);
        console.log(JSON.stringify({ sample, pages: pageCount, detections, aadhaar, faces, uidaiQr, otherQr, uncertainMasks }));
      } finally {
        await download.delete();
      }
      await page.getByTestId('redactor-start-over-btn').click();
      await expect(page.getByTestId('redaction-preview')).toHaveCount(0);
    } catch {
      throw new Error(`Private ${sample} failed during ${stage}; document details withheld.`);
    }
  });
}
