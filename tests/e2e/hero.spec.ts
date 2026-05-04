/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { test, expect } from '@playwright/test';

test.describe('Desktop hero', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('hero illustration is visible', async ({ page }) => {
    await page.goto('/');
    const img = page.locator('img[src="/hero-before-after.svg"]');
    await expect(img).toBeVisible();
  });

  test('"Try a sample ID" button is visible and enabled', async ({ page }) => {
    await page.goto('/');
    const btn = page.getByTestId('try-sample-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test('"Try a sample ID" button processes the bundled sample successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('try-sample-btn')).toBeVisible();
    await page.getByTestId('try-sample-btn').click();
    // The bundled sample contains a Verhoeff-valid synthetic Aadhaar number,
    // so detection must succeed end-to-end (no decode errors).
    await expect(page.getByText(/Found \d+ detection/i)).toBeVisible({
      timeout: 30_000,
    });
  });

  test('detection chips strip contains all 5 labels', async ({ page }) => {
    await page.goto('/');
    // Scope to .chip spans to avoid matching nav links that share substrings
    const chips = page.locator('span.chip');
    await expect(chips.filter({ hasText: 'Aadhaar' })).toBeVisible();
    await expect(chips.filter({ hasText: 'PAN' })).toBeVisible();
    await expect(chips.filter({ hasText: 'Passport MRZ' })).toBeVisible();
    await expect(chips.filter({ hasText: 'UIDAI QR' })).toBeVisible();
    await expect(chips.filter({ hasText: 'Faces' })).toBeVisible();
  });
});
