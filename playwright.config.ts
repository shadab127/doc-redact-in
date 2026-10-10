/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);
const E2E_URL = `http://localhost:${E2E_PORT}`;
const production = process.env.E2E_PRODUCTION === '1';
const privateSamples = process.env.RUN_LOCAL_SAMPLES === '1';
const privateOutput = process.env.PRIVATE_TEST_OUTPUT_DIR;
if (privateSamples && (!production || !privateOutput || !path.isAbsolute(privateOutput)
  || !path.relative(process.cwd(), privateOutput).startsWith(`..${path.sep}`)
  || process.env.PLAYWRIGHT_NO_COPY_PROMPT !== '1')) {
  throw new Error('Use npm run test:e2e:private for private samples.');
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: privateSamples ? 'local-samples.spec.ts' : undefined,
  outputDir: privateSamples ? privateOutput : undefined,
  fullyParallel: !privateSamples,
  workers: privateSamples ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  retries: privateSamples ? 0 : process.env.CI ? 2 : 0,
  reporter: privateSamples ? 'line' : process.env.CI ? 'github' : 'html',
  use: {
    baseURL: E2E_URL,
    trace: privateSamples ? 'off' : 'retain-on-failure',
    screenshot: 'off',
    video: 'off',
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: production
      ? `PORT=${E2E_PORT} npm run preview`
      : `npm run dev -- --port ${E2E_PORT}`,
    url: E2E_URL,
    reuseExistingServer: !process.env.CI && !production,
    timeout: 120_000,
  },
});
