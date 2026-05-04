/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { test, expect } from '@playwright/test';

test.describe('theme toggle', () => {
  test('defaults to light theme when no system dark preference', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'light' });
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000/');
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(theme).toBe('light');
    await ctx.close();
  });

  test('applies dark when system prefers dark and no override is saved', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000/');
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(theme).toBe('dark');
    await ctx.close();
  });

  test('toggle flips theme and persists to localStorage', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'light' });
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000/');

    await expect(page).toHaveURL('http://localhost:3000/');
    const toggle = page.locator('.theme-toggle');
    await expect(toggle).toBeVisible();

    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const saved = await page.evaluate(() => localStorage.getItem('docredact-theme'));
    expect(saved).toBe('dark');

    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const saved2 = await page.evaluate(() => localStorage.getItem('docredact-theme'));
    expect(saved2).toBe('light');

    await ctx.close();
  });

  test('saved override wins over system preference (no flash)', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('docredact-theme', 'light');
    });
    await page.goto('http://localhost:3000/');
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(theme).toBe('light');
    await ctx.close();
  });
});
