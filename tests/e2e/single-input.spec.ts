/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { test, expect } from '@playwright/test';

test('desktop viewport renders exactly 1 file input', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'DocRedact.in' })).toBeVisible();
  // Wait for the hook to resolve (isMobile !== null) — the inputs appear after mount
  await expect(page.locator('input[type=file]')).toHaveCount(1);
});

test('mobile viewport renders exactly 2 file inputs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'DocRedact.in' })).toBeVisible();
  // Wait for the hook to resolve — both CameraCapture + DropZone inputs appear
  await expect(page.locator('input[type=file]')).toHaveCount(2);
});
