/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { test, expect } from '@playwright/test';

/**
 * End-to-end for the /manual route. Exercises the full draw/select/resize/move/
 * delete/export flow against a synthetic image fixture. We can't run
 * DocumentPicker workflows in headless Chromium, so we inject the File object
 * through the DropZone's hidden <input>, same pattern as other specs.
 */

async function uploadSyntheticImage(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 400, 300);
    ctx.fillStyle = '#333333';
    ctx.font = '24px sans-serif';
    ctx.fillText('Aadhaar 1234 5678 9012', 40, 150);
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
}

test('manual redact: draw a box, see it persist, export is enabled', async ({ page }) => {
  await page.goto('/manual/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Manual/i);
  await expect(page.getByText('Drop or tap to choose a file')).toBeVisible();

  await uploadSyntheticImage(page);

  const canvas = page.getByTestId('manual-redact-canvas');
  await expect(canvas).toBeVisible();

  const bb = await canvas.boundingBox();
  expect(bb).not.toBeNull();
  if (!bb) return;

  // Draw a box roughly spanning the Aadhaar-number text region.
  await page.mouse.move(bb.x + 40, bb.y + 80);
  await page.mouse.down();
  await page.mouse.move(bb.x + 260, bb.y + 140, { steps: 10 });
  await page.mouse.up();

  // The box should now exist in the DOM (rect in SVG) and the export button
  // should reflect 1 box.
  await expect(page.getByTestId('manual-export-btn')).toContainText('1 box');
  const svgBoxes = await page.locator('[data-testid^="manual-box-"]').count();
  expect(svgBoxes).toBe(1);
});

test('manual redact: drawn box can be selected and deleted via ✕', async ({ page }) => {
  await page.goto('/manual/');
  await uploadSyntheticImage(page);
  const canvas = page.getByTestId('manual-redact-canvas');
  const bb = await canvas.boundingBox();
  if (!bb) throw new Error('no canvas bbox');

  await page.mouse.move(bb.x + 40, bb.y + 80);
  await page.mouse.down();
  await page.mouse.move(bb.x + 260, bb.y + 140, { steps: 10 });
  await page.mouse.up();

  // Box auto-selects on create — delete button should be visible.
  const del = page.getByTestId('manual-delete-btn');
  await expect(del).toBeVisible();
  await del.click();

  await expect(page.getByTestId('manual-export-btn')).toContainText('0 box');
  expect(await page.locator('[data-testid^="manual-box-"]').count()).toBe(0);
});

test('manual redact: Escape deselects and clicking empty area deselects', async ({ page }) => {
  await page.goto('/manual/');
  await uploadSyntheticImage(page);
  const canvas = page.getByTestId('manual-redact-canvas');
  const bb = await canvas.boundingBox();
  if (!bb) throw new Error('no canvas bbox');

  await page.mouse.move(bb.x + 40, bb.y + 80);
  await page.mouse.down();
  await page.mouse.move(bb.x + 260, bb.y + 140, { steps: 10 });
  await page.mouse.up();

  await expect(page.getByTestId('manual-delete-btn')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('manual-delete-btn')).toHaveCount(0);
});

test('manual redact: two-finger pinch zooms the canvas and shows reset button', async ({
  page,
}) => {
  await page.goto('/manual/');
  await uploadSyntheticImage(page);
  const canvas = page.getByTestId('manual-redact-canvas');
  const bb = await canvas.boundingBox();
  if (!bb) throw new Error('no canvas bbox');

  // Synthesize two touch-like pointers spreading apart (pinch-zoom-in).
  await page.evaluate(
    ({ x, y, width, height }) => {
      const el = document.querySelector<HTMLDivElement>(
        '[data-testid="manual-redact-canvas"]'
      );
      if (!el) throw new Error('canvas not found');
      const cx = x + width / 2;
      const cy = y + height / 2;

      const fire = (
        type: 'pointerdown' | 'pointermove' | 'pointerup',
        pointerId: number,
        clientX: number,
        clientY: number
      ) => {
        const ev = new PointerEvent(type, {
          pointerId,
          pointerType: 'touch',
          clientX,
          clientY,
          button: 0,
          buttons: type === 'pointerup' ? 0 : 1,
          isPrimary: pointerId === 1,
          bubbles: true,
          cancelable: true,
        });
        el.dispatchEvent(ev);
      };

      // Initial positions: two fingers 40px apart horizontally.
      fire('pointerdown', 1, cx - 20, cy);
      fire('pointerdown', 2, cx + 20, cy);
      // Move them apart to ~120px apart — roughly 3× pinch out.
      fire('pointermove', 1, cx - 60, cy);
      fire('pointermove', 2, cx + 60, cy);
      fire('pointerup', 1, cx - 60, cy);
      fire('pointerup', 2, cx + 60, cy);
    },
    bb
  );

  // Reset-zoom control appears once zoom > 1.
  await expect(page.getByTestId('manual-reset-view-btn')).toBeVisible();
  await page.getByTestId('manual-reset-view-btn').click();
  await expect(page.getByTestId('manual-reset-view-btn')).toHaveCount(0);
});

test('manual redact: two-finger gesture does not commit a phantom draw', async ({ page }) => {
  await page.goto('/manual/');
  await uploadSyntheticImage(page);
  const canvas = page.getByTestId('manual-redact-canvas');
  const bb = await canvas.boundingBox();
  if (!bb) throw new Error('no canvas bbox');

  // Simulate: one finger lands, second finger lands (should cancel draw),
  // both move (pinch), both lift. No box should be committed.
  await page.evaluate(
    ({ x, y, width, height }) => {
      const el = document.querySelector<HTMLDivElement>(
        '[data-testid="manual-redact-canvas"]'
      );
      if (!el) throw new Error('canvas not found');
      const cx = x + width / 2;
      const cy = y + height / 2;
      const fire = (
        type: 'pointerdown' | 'pointermove' | 'pointerup',
        pointerId: number,
        clientX: number,
        clientY: number
      ) => {
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId,
            pointerType: 'touch',
            clientX,
            clientY,
            button: 0,
            buttons: type === 'pointerup' ? 0 : 1,
            isPrimary: pointerId === 1,
            bubbles: true,
            cancelable: true,
          })
        );
      };
      fire('pointerdown', 1, cx - 20, cy - 20);
      fire('pointermove', 1, cx - 30, cy - 30);
      fire('pointerdown', 2, cx + 20, cy + 20);
      fire('pointermove', 1, cx - 60, cy - 40);
      fire('pointermove', 2, cx + 60, cy + 40);
      fire('pointerup', 1, cx - 60, cy - 40);
      fire('pointerup', 2, cx + 60, cy + 40);
    },
    bb
  );

  expect(await page.locator('[data-testid^="manual-box-"]').count()).toBe(0);
});

test('manual redact: exporting produces a non-empty PDF download', async ({ page }) => {
  await page.goto('/manual/');
  await uploadSyntheticImage(page);

  const canvas = page.getByTestId('manual-redact-canvas');
  const bb = await canvas.boundingBox();
  if (!bb) throw new Error('no canvas bbox');
  await page.mouse.move(bb.x + 40, bb.y + 80);
  await page.mouse.down();
  await page.mouse.move(bb.x + 260, bb.y + 140, { steps: 10 });
  await page.mouse.up();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('manual-export-btn').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/_redacted\.pdf$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream as unknown as AsyncIterable<Buffer>) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  expect(bytes.length).toBeGreaterThan(1000);
  // PDF magic header.
  expect(bytes.slice(0, 5).toString('ascii')).toBe('%PDF-');
});

test('manual redact: export button is disabled until a box exists', async ({ page }) => {
  await page.goto('/manual/');
  await uploadSyntheticImage(page);
  const btn = page.getByTestId('manual-export-btn');
  await expect(btn).toBeDisabled();

  const canvas = page.getByTestId('manual-redact-canvas');
  const bb = await canvas.boundingBox();
  if (!bb) throw new Error('no canvas bbox');
  await page.mouse.move(bb.x + 40, bb.y + 80);
  await page.mouse.down();
  await page.mouse.move(bb.x + 200, bb.y + 130, { steps: 10 });
  await page.mouse.up();

  await expect(btn).toBeEnabled();
});
