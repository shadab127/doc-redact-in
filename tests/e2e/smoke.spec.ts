/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { test, expect } from '@playwright/test';

test('landing page renders the redactor', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'DocRedact.in' })).toBeVisible();
  await expect(page.getByText('Nothing leaves your device')).toBeVisible();
  await expect(page.getByText('Drop or tap to choose a file')).toBeVisible();
});
