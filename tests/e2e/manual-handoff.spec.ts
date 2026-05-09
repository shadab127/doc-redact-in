/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { test, expect, type Page } from '@playwright/test';

// Uses the bundled sample Aadhaar (Verhoeff-valid synthetic) so detection
// produces real seed boxes to hand off. Matches the hero sample smoke pattern.
async function runAutoDetect(page: Page) {
  await page.goto('/');
  // Module-level session persists across tests in the same worker; force a
  // fresh start so counts are predictable. If a previous test left results
  // mounted, "Start over" is visible; otherwise we're already idle.
  const startOver = page.getByTestId('redactor-start-over-btn');
  if (await startOver.isVisible().catch(() => false)) {
    await startOver.click();
  }
  await page.getByTestId('try-sample-btn').click();
  await expect(page.getByText(/Found \d+ detection/i)).toBeVisible({
    timeout: 30_000,
  });
}

async function drawNewBoxInCorner(page: Page) {
  const canvas = page.getByTestId('manual-redact-canvas');
  const bb = await canvas.boundingBox();
  if (!bb) throw new Error('no canvas bbox');
  // Draw in the top-left corner, outside the typical seeded-box regions for
  // the bundled Aadhaar sample (which populates the middle and right).
  const startX = bb.x + 6;
  const startY = bb.y + 6;
  const endX = bb.x + 60;
  const endY = bb.y + 50;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.mouse.up();
}

test('handoff link: click navigates to /manual with seeded boxes', async ({ page }) => {
  await runAutoDetect(page);

  const enabledCount = await page.evaluate(() => {
    const inputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[data-testid^="toggle-"]')
    );
    return inputs.filter((i) => i.checked).length;
  });
  expect(enabledCount).toBeGreaterThan(0);

  await page.getByTestId('open-manual-mode-btn').click();
  await expect(page).toHaveURL(/\/manual\/?$/);

  await expect(page.getByTestId('manual-redact-canvas')).toBeVisible();
  await expect(page.getByText('Drop or tap to choose a file')).toHaveCount(0);

  await expect(page.getByTestId('manual-export-btn')).toContainText(
    `${enabledCount} box`
  );

  // Clean up: clear manual session so other tests start with predictable state.
  await page.getByRole('button', { name: 'Start over' }).click();
});

test('handoff link: toggled-off detections are excluded from seed boxes', async ({
  page,
}) => {
  await runAutoDetect(page);

  const initialEnabled = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLInputElement>('input[data-testid^="toggle-"]')
    ).filter((i) => i.checked).length
  );
  if (initialEnabled < 2) test.skip(true, 'need at least 2 enabled detections to uncheck one');

  const firstEnabled = page
    .locator('input[data-testid^="toggle-"]:checked')
    .first();
  await firstEnabled.uncheck();

  await page.getByTestId('open-manual-mode-btn').click();
  await expect(page).toHaveURL(/\/manual\/?$/);

  await expect(page.getByTestId('manual-export-btn')).toContainText(
    `${initialEnabled - 1} box`
  );

  await page.getByRole('button', { name: 'Start over' }).click();
});

test('/ state survives handoff → back navigation', async ({ page }) => {
  await runAutoDetect(page);
  const foundText = await page
    .getByText(/Found \d+ detection/i)
    .textContent();
  await page.getByTestId('open-manual-mode-btn').click();
  await expect(page).toHaveURL(/\/manual\/?$/);
  await page.goBack();
  // The same "Found N detections" line should still be present (same session).
  await expect(page.getByText(/Found \d+ detection/i)).toBeVisible();
  expect(
    (await page.getByText(/Found \d+ detection/i).textContent())?.trim()
  ).toBe(foundText?.trim());

  await page.getByTestId('redactor-start-over-btn').click();
});

test('second handoff with dirty edits shows modal; "Keep my edits" preserves them', async ({
  page,
}) => {
  await runAutoDetect(page);
  await page.getByTestId('open-manual-mode-btn').click();
  await expect(page.getByTestId('manual-redact-canvas')).toBeVisible();

  const initialCount = await page.locator('[data-testid^="manual-box-"]').count();
  await drawNewBoxInCorner(page);
  await expect(page.locator('[data-testid^="manual-box-"]')).toHaveCount(
    initialCount + 1
  );

  await page.goBack();
  await expect(page.getByText(/Found \d+ detection/i)).toBeVisible();

  await page.getByTestId('open-manual-mode-btn').click();
  await expect(page.getByTestId('confirm-replace-modal')).toBeVisible();
  await page.getByTestId('confirm-replace-keep').click();
  await expect(page.getByTestId('confirm-replace-modal')).toHaveCount(0);

  // Drawn box still present.
  await expect(page.locator('[data-testid^="manual-box-"]')).toHaveCount(
    initialCount + 1
  );

  await page.getByRole('button', { name: 'Start over' }).click();
});

test('second handoff with dirty edits — "Replace" discards edits and reseeds', async ({
  page,
}) => {
  await runAutoDetect(page);
  const initialSeededCount = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLInputElement>('input[data-testid^="toggle-"]')
    ).filter((i) => i.checked).length
  );

  await page.getByTestId('open-manual-mode-btn').click();
  await expect(page.getByTestId('manual-redact-canvas')).toBeVisible();

  await drawNewBoxInCorner(page);
  await expect(page.locator('[data-testid^="manual-box-"]')).toHaveCount(
    initialSeededCount + 1
  );

  await page.goBack();
  await expect(page.getByText(/Found \d+ detection/i)).toBeVisible();

  await page.getByTestId('open-manual-mode-btn').click();
  await expect(page.getByTestId('confirm-replace-modal')).toBeVisible();
  await page.getByTestId('confirm-replace-replace').click();
  await expect(page.getByTestId('confirm-replace-modal')).toHaveCount(0);

  // Reseeded: original count, drawn box gone.
  await expect(page.locator('[data-testid^="manual-box-"]')).toHaveCount(
    initialSeededCount
  );

  await page.getByRole('button', { name: 'Start over' }).click();
});

test('modal: Escape key acts as "Keep my edits"', async ({ page }) => {
  await runAutoDetect(page);
  await page.getByTestId('open-manual-mode-btn').click();
  await expect(page.getByTestId('manual-redact-canvas')).toBeVisible();

  const initialCount = await page.locator('[data-testid^="manual-box-"]').count();
  await drawNewBoxInCorner(page);
  await expect(page.locator('[data-testid^="manual-box-"]')).toHaveCount(
    initialCount + 1
  );

  await page.goBack();
  await page.getByTestId('open-manual-mode-btn').click();
  await expect(page.getByTestId('confirm-replace-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('confirm-replace-modal')).toHaveCount(0);
  await expect(page.locator('[data-testid^="manual-box-"]')).toHaveCount(
    initialCount + 1
  );

  await page.getByRole('button', { name: 'Start over' }).click();
});

test('handoff flow sends zero cross-origin requests', async ({ page, baseURL }) => {
  const baseHost = new URL(baseURL!).host;
  const outbound: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('blob:') || url.startsWith('data:')) return;
    try {
      const host = new URL(url).host;
      if (host !== baseHost) outbound.push(`${req.method()} ${url}`);
    } catch {
      // ignore non-URL entries
    }
  });

  await runAutoDetect(page);
  await page.getByTestId('open-manual-mode-btn').click();
  await expect(page.getByTestId('manual-redact-canvas')).toBeVisible();

  if (outbound.length > 0) {
    throw new Error(
      `Privacy invariant violated during handoff:\n${outbound.join('\n')}`
    );
  }

  await page.getByRole('button', { name: 'Start over' }).click();
});
