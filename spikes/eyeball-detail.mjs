/**
 * Eyeball diagnostic — dump raw OCR tokens for the two flipped samples
 * to help verify true vs false positives and understand the regression.
 */
import { createWorker } from '/Users/shadab.khan/toast/hobby-projects/doc-redact-in/node_modules/tesseract.js/src/index.js';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LANG_PATH = path.join(__dirname, '..', 'public/vendor/tesseract-lang');
const CACHE_DIR = path.join(tmpdir(), 'tesseract-spike-cache');
const SAMPLES_DIR = '/Users/shadab.khan/Downloads/real_aadhaar_samples';
const PREPROCESS_SCRIPT = path.join(__dirname, 'preprocess_image.py');

mkdirSync(CACHE_DIR, { recursive: true });

// Get actual filenames
const ALL_SAMPLES = readdirSync(SAMPLES_DIR).filter(f => {
  const lower = f.toLowerCase();
  return !lower.endsWith('.pdf') && !lower.endsWith('.webp') && !f.startsWith('.');
});

// The two flipped samples
const FLIP_UP = ALL_SAMPLES.find(f => f.includes('9.56.28'));
const FLIP_DOWN = ALL_SAMPLES.find(f => f.includes('3.06.30'));

console.log('Flipped-up sample:', FLIP_UP);
console.log('Flipped-down sample:', FLIP_DOWN);

function convertResultToTokens(result) {
  const tokens = [];
  result.data.lines.forEach((line, lineIdx) => {
    for (const word of line.words) {
      const text = word.text.trim();
      if (!text) continue;
      tokens.push({ text, confidence: word.confidence / 100, lineId: lineIdx });
    }
  });
  return tokens;
}

async function inspect(worker, label, imagePath) {
  console.log(`\n=== ${label} ===`);
  const result = await worker.recognize(imagePath);
  const tokens = convertResultToTokens(result);
  // Show all tokens that look digit-heavy (potential Aadhaar fragments)
  const digitRich = tokens.filter(t => (t.text.replace(/\D/g, '').length / Math.max(1, t.text.length)) > 0.5);
  console.log(`Total tokens: ${tokens.length}, digit-rich: ${digitRich.length}`);
  console.log('All tokens:', tokens.map(t => `"${t.text}"(c=${t.confidence.toFixed(2)},L${t.lineId})`).join(' '));
  // Show all 4-digit groups
  const groups = tokens.filter(t => /^\d{4}$/.test(t.text));
  console.log('4-digit groups:', groups.map(t => `"${t.text}"(L${t.lineId})`).join(', '));
}

async function main() {
  const worker = await createWorker('eng', 1, {
    langPath: LANG_PATH,
    cachePath: CACHE_DIR,
    gzip: true,
    logger: () => {},
  });

  if (FLIP_UP) {
    const origPath = path.join(SAMPLES_DIR, FLIP_UP);
    const tmpPng = path.join(CACHE_DIR, 'eyeball_flip_up.png');
    spawnSync('python3', [PREPROCESS_SCRIPT, origPath, tmpPng], { timeout: 30000 });

    await inspect(worker, `MISS→HIT: ${FLIP_UP} (BASELINE)`, origPath);
    await inspect(worker, `MISS→HIT: ${FLIP_UP} (PREPROCESSED)`, tmpPng);
  }

  if (FLIP_DOWN) {
    const origPath = path.join(SAMPLES_DIR, FLIP_DOWN);
    const tmpPng = path.join(CACHE_DIR, 'eyeball_flip_down.png');
    spawnSync('python3', [PREPROCESS_SCRIPT, origPath, tmpPng], { timeout: 30000 });

    await inspect(worker, `HIT→MISS: ${FLIP_DOWN} (BASELINE)`, origPath);
    await inspect(worker, `HIT→MISS: ${FLIP_DOWN} (PREPROCESSED)`, tmpPng);
  }

  await worker.terminate();
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
