/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 *
 * Accuracy harness — runs the full detection pipeline in a real browser
 * against the real Aadhaar sample set and writes a per-sample report.
 *
 * Skipped by default; enable with RUN_ACCURACY=1 and point ACCURACY_SAMPLE_DIR
 * at a local directory of your own sample documents (never commit real IDs).
 *   RUN_ACCURACY=1 ACCURACY_SAMPLE_DIR=/path/to/samples \
 *     npx playwright test --project=chromium accuracy-harness
 *
 * Report: spikes/report-accuracy-<ISO>.md (written incrementally, gitignored).
 */
import { test, expect, type Page } from '@playwright/test';
import { readdirSync, appendFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';

const SAMPLE_DIR = process.env.ACCURACY_SAMPLE_DIR ?? resolve(__dirname, '../samples');

const REPORT_DIR = resolve(__dirname, '../../spikes');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const REPORT_PATH = join(REPORT_DIR, `report-accuracy-${timestamp}.md`);

const KIND_TO_LABEL: Record<string, RegExp> = {
  aadhaar: /Aadhaar number/i,
  pan: /PAN card number/i,
  passport_mrz: /Passport MRZ/i,
  face: /Face photograph/i,
  uidai_qr: /UIDAI QR code/i,
  other_qr: /Other QR code/i,
};

type Counts = Record<keyof typeof KIND_TO_LABEL, number>;

function emptyCounts(): Counts {
  return { aadhaar: 0, pan: 0, passport_mrz: 0, face: 0, uidai_qr: 0, other_qr: 0 };
}

function listSamples(): string[] {
  return readdirSync(SAMPLE_DIR)
    .filter((f) => /\.(jpe?g|png|webp|pdf)$/i.test(f))
    .sort();
}

async function readCounts(page: Page): Promise<Counts> {
  // The toggle list renders one <li> per detection. Each li contains a div
  // whose first child text is the human label (see KIND_LABELS in
  // DetectionToggleList.tsx). Count by label regex.
  const labels = await page.evaluate(() => {
    const lis = Array.from(document.querySelectorAll('li'));
    return lis
      .map((li) => {
        const firstDiv = li.querySelector('div > div');
        return firstDiv?.textContent?.trim() ?? '';
      })
      .filter((s) => s.length > 0);
  });
  const counts = emptyCounts();
  for (const label of labels) {
    if (!label) continue;
    for (const [kind, re] of Object.entries(KIND_TO_LABEL) as [keyof Counts, RegExp][]) {
      if (re.test(label)) {
        counts[kind] = (counts[kind] ?? 0) + 1;
        break;
      }
    }
  }
  return counts;
}

test.describe('accuracy harness', () => {
  test.skip(!process.env.RUN_ACCURACY, 'Gated by RUN_ACCURACY=1');
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    if (!existsSync(REPORT_DIR)) mkdirSync(REPORT_DIR, { recursive: true });
    writeFileSync(
      REPORT_PATH,
      `# Accuracy harness — ${timestamp}\n\n` +
        `Dataset: \`${SAMPLE_DIR}\`\n\n` +
        `Pipeline: production detectors in Chromium (Playwright) via \`npm run dev\`.\n\n` +
        `| sample | status | aadhaar | face | uidai_qr | other_qr | pan | mrz | totalMs |\n` +
        `|---|---|---:|---:|---:|---:|---:|---:|---:|\n`
    );
  });

  test('run all samples', async ({ page }) => {
    test.setTimeout(90 * 60 * 1000); // 90 min cap for whole run
    const samples = listSamples();
    console.log(`[harness] ${samples.length} samples`);

    await page.goto('/');
    await expect(page.getByText('Drop or tap to choose a file')).toBeVisible();

    const totals = emptyCounts();
    const statusTally = { hit: 0, miss: 0, error: 0 };

    for (let i = 0; i < samples.length; i++) {
      const name = samples[i]!;
      const full = join(SAMPLE_DIR, name);
      const started = Date.now();
      let status: 'hit' | 'miss' | 'error' = 'miss';
      let counts = emptyCounts();
      let totalMs = 0;

      try {
        // Set file; dropzone-input's onChange clears input.value afterwards
        // so we can re-use the same element for the next sample.
        const input = page.locator('[data-testid="dropzone-input"]');
        await input.setInputFiles(full);

        // Wait for either a "Found N detection" line or an error view.
        // 2-min per-sample cap — rotated PDFs are the slowest.
        const doneLocator = page.getByText(/Found \d+ detection/);
        const errorLocator = page.locator('[data-testid="error-details"]').or(
          page.getByText(/Something went wrong|File too large|Unsupported/)
        );

        await Promise.race([
          doneLocator.first().waitFor({ state: 'visible', timeout: 120_000 }),
          errorLocator.first().waitFor({ state: 'visible', timeout: 120_000 }),
        ]);

        if (await doneLocator.first().isVisible().catch(() => false)) {
          counts = await readCounts(page);
          const sum = Object.values(counts).reduce((a, b) => a + b, 0);
          status = sum > 0 ? 'hit' : 'miss';
          // Pull latency from the "in N ms" text when present
          const txt = (await page
            .getByText(/Found \d+ detection[s]? across .* in \d+ ms\./)
            .first()
            .textContent()) ?? '';
          const m = txt.match(/in (\d+) ms/);
          totalMs = m ? Number(m[1]) : Date.now() - started;
        } else {
          status = 'error';
        }
      } catch (e) {
        status = 'error';
        console.log(`[harness] ${name}: ${(e as Error).message}`);
      }

      // Update totals
      for (const k of Object.keys(totals) as (keyof Counts)[]) {
        totals[k] = (totals[k] ?? 0) + (counts[k] ?? 0);
      }
      statusTally[status]++;

      const safeName = name.replace(/\|/g, '\\|');
      const row =
        `| \`${safeName}\` | ${status} | ` +
        `${counts.aadhaar} | ${counts.face} | ${counts.uidai_qr} | ${counts.other_qr} | ` +
        `${counts.pan} | ${counts.passport_mrz} | ${totalMs} |\n`;
      appendFileSync(REPORT_PATH, row);
      console.log(
        `[harness] ${i + 1}/${samples.length} ${status.padEnd(5)} ${safeName} ` +
          `a=${counts.aadhaar} f=${counts.face} q=${counts.uidai_qr}`
      );
    }

    appendFileSync(
      REPORT_PATH,
      `\n\n## Aggregate\n\n` +
        `- Samples: **${samples.length}**\n` +
        `- hit / miss / error: **${statusTally.hit} / ${statusTally.miss} / ${statusTally.error}**\n` +
        `- Aadhaar detections (total): ${totals.aadhaar}\n` +
        `- Face detections (total): ${totals.face}\n` +
        `- UIDAI QR detections (total): ${totals.uidai_qr}\n` +
        `- Other QR detections (total): ${totals.other_qr}\n` +
        `- PAN detections (total): ${totals.pan}\n` +
        `- Passport MRZ detections (total): ${totals.passport_mrz}\n`
    );
    console.log(`[harness] report -> ${REPORT_PATH}`);
  });
});
