/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { test, expect } from '@playwright/test';

// A file with a valid PNG magic header but corrupted body so that
// createImageBitmap rejects it with the decode error we want to map.
// PNG magic: 8 bytes, then junk — browsers reject this at decode time.
const CORRUPT_PNG_BASE64 = Buffer.from(
  // PNG signature (8 bytes) followed by garbage bytes
  '\x89PNG\r\n\x1a\nNOT_A_REAL_PNG_BODY_GARBAGE_GARBAGE_GARBAGE'
).toString('base64');

test('corrupt PNG shows a friendly error, not a raw vendor string', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'DocRedact.in' })).toBeVisible();

  await page.evaluate((base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'image/png' });
    const file = new File([blob], 'corrupt.png', { type: 'image/png' });
    const input = document.querySelector<HTMLInputElement>('[data-testid="dropzone-input"]');
    if (!input) throw new Error('dropzone-input not found');
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, CORRUPT_PNG_BASE64);

  // Wait for either success or an error to appear (decode errors are fast).
  await page.waitForFunction(
    () =>
      document.body.textContent?.includes('Found') ||
      document.body.textContent?.includes("Couldn't read") ||
      document.body.textContent?.includes('went wrong'),
    null,
    { timeout: 30_000 }
  );

  // The friendly message should be visible.
  const errorText = page.getByText("Couldn't read this image. Try a JPG or PNG export, or a clearer photo.");
  await expect(errorText).toBeVisible({ timeout: 5_000 });

  // Must not leak raw vendor strings.
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain('source image');
  expect(bodyText).not.toContain('MediaPipe');
  expect(bodyText).not.toContain('decoded');
});
