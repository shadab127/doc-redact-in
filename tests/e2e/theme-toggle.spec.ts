// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { test, expect } from '@playwright/test';

test.describe('theme toggle', () => {
  test('defaults to light theme when no system dark preference', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ colorScheme: 'light', baseURL });
    try {
      const page = await ctx.newPage();
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    } finally {
      await ctx.close();
    }
  });

  test('applies dark when system prefers dark and no override is saved', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark', baseURL });
    try {
      const page = await ctx.newPage();
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    } finally {
      await ctx.close();
    }
  });

  test('toggle flips theme and persists to localStorage', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ colorScheme: 'light', baseURL });
    try {
      const page = await ctx.newPage();
      await page.goto('/');
      const toggle = page.locator('.theme-toggle');
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      expect(await page.evaluate(() => localStorage.getItem('docredact-theme'))).toBe('dark');
      await toggle.click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      expect(await page.evaluate(() => localStorage.getItem('docredact-theme'))).toBe('light');
    } finally {
      await ctx.close();
    }
  });

  test('saved override wins over system preference (no flash)', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark', baseURL });
    try {
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        localStorage.setItem('docredact-theme', 'light');
      });
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    } finally {
      await ctx.close();
    }
  });
});
