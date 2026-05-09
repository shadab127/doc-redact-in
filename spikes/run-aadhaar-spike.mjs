/**
 * Aadhaar recall spike harness — ImagePreprocessor integration test.
 *
 * Runs tesseract.js (Node mode) on each sample image twice:
 *   1. Baseline: raw image path
 *   2. Preprocessed: Python-generated PNG (grayscale + gaussianBlur3x3 + CLAHE)
 *
 * Uses the same AadhaarDetector + Verhoeff logic as production.
 * No new npm deps. No TypeScript — plain ES module.
 */

import { createWorker } from '/Users/shadab.khan/toast/hobby-projects/doc-redact-in/node_modules/tesseract.js/src/index.js';
import { spawnSync } from 'node:child_process';
import { mkdirSync, appendFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const LANG_PATH = path.join(PROJECT_ROOT, 'public/vendor/tesseract-lang');
const CACHE_DIR = path.join(tmpdir(), 'tesseract-spike-cache');
const REPORT_PATH = path.join(__dirname, 'report-aadhaar.md');
const SAMPLES_DIR = '/Users/shadab.khan/Downloads/real_aadhaar_samples';
const PREPROCESS_SCRIPT = path.join(__dirname, 'preprocess_image.py');

mkdirSync(CACHE_DIR, { recursive: true });

// ─── Verhoeff ────────────────────────────────────────────────────────────────
const D = [
  [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],
  [3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],
  [6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],
  [9,8,7,6,5,4,3,2,1,0],
];
const P = [
  [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],
  [8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],
  [2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
];

function isValidVerhoeff(s) {
  if (!s) return false;
  const digits = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return false;
    digits.push(c - 48);
  }
  if (digits.length === 0) return false;
  let c = 0;
  for (let i = 0; i < digits.length; i++) {
    const digit = digits[digits.length - 1 - i];
    c = D[c][P[i % 8][digit]];
  }
  return c === 0;
}

// ─── AadhaarDetector ─────────────────────────────────────────────────────────
const GROUP_RE = /^\d{4}$/;
const INLINE_RE = /\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b/g;

function tokensByLine(tokens) {
  const by = new Map();
  for (const t of tokens) {
    if (!by.has(t.lineId)) by.set(t.lineId, []);
    by.get(t.lineId).push(t);
  }
  for (const line of by.values()) line.sort((a, b) => a.bbox.x - b.bbox.x);
  return by;
}

function detectAadhaar(tokens) {
  const out = [];
  for (const line of tokensByLine(tokens).values()) {
    for (let i = 0; i + 2 < line.length; i++) {
      const [a, b, c] = [line[i], line[i+1], line[i+2]];
      if (!a || !b || !c) continue;
      if (!GROUP_RE.test(a.text) || !GROUP_RE.test(b.text) || !GROUP_RE.test(c.text)) continue;
      const candidate = a.text + b.text + c.text;
      if (isValidVerhoeff(candidate)) out.push({ value: candidate, source: 'triplet' });
    }
  }
  for (const t of tokens) {
    const matches = [...t.text.matchAll(INLINE_RE)];
    for (const m of matches) {
      const candidate = m[1] + m[2] + m[3];
      if (isValidVerhoeff(candidate) && !out.some(e => e.value === candidate)) {
        out.push({ value: candidate, source: 'inline' });
      }
    }
  }
  return out;
}

// ─── OCR helpers ─────────────────────────────────────────────────────────────
function convertResultToTokens(result) {
  const tokens = [];
  result.data.lines.forEach((line, lineIdx) => {
    for (const word of line.words) {
      const text = word.text.trim();
      if (!text) continue;
      tokens.push({
        text,
        bbox: { x: word.bbox.x0, y: word.bbox.y0, w: word.bbox.x1 - word.bbox.x0, h: word.bbox.y1 - word.bbox.y0 },
        confidence: word.confidence / 100,
        lineId: lineIdx,
      });
    }
  });
  return tokens;
}

// ─── Report helpers ───────────────────────────────────────────────────────────
function appendReport(line) {
  appendFileSync(REPORT_PATH, line + '\n');
  process.stdout.write(line + '\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
// Read filenames directly from directory to handle Unicode narrow-space in macOS screenshot names
const SAMPLES = readdirSync(SAMPLES_DIR).filter(f => {
  // Skip PDFs (require rasterization), webp extras, hidden files
  const lower = f.toLowerCase();
  return !lower.endsWith('.pdf') && !lower.endsWith('.webp') && !f.startsWith('.');
});

async function main() {
  // Rewrite the report file with updated header
  const { writeFileSync } = await import('node:fs');
  writeFileSync(REPORT_PATH, `# Aadhaar Recall Spike — ImagePreprocessor Integration

**Started:** ${new Date().toISOString()}
**Hypothesis:** Wiring ImagePreprocessor.ts into OCR path lifts Aadhaar recall from 80% baseline
**Single variable:** preprocessor on vs off — everything else constant
**Samples:** ${SAMPLES.length} image files (PDFs excluded from this spike; require rasterization)
**Preprocessor pipeline:** toGrayscale(BT.601) → gaussianBlur3x3 → applyClaheGlobal(clipLimit=0.01)

---

## Per-Sample Results

| filename | baseline | preprocessed | notes |
|----------|----------|--------------|-------|
`);

  // Create Tesseract worker
  console.log('Creating Tesseract worker...');
  const worker = await createWorker('eng', 1, {
    langPath: LANG_PATH,
    cachePath: CACHE_DIR,
    gzip: true,
    logger: () => {},
  });
  console.log('Worker ready.');

  const results = [];

  for (const sample of SAMPLES) {
    const samplePath = path.join(SAMPLES_DIR, sample);
    const tmpPng = path.join(CACHE_DIR, `preprocessed_${sample.replace(/[^a-zA-Z0-9.]/g, '_')}.png`);
    const shortName = sample.length > 50 ? sample.slice(0, 47) + '...' : sample;

    let baselineHit = false;
    let preprocessedHit = false;
    let baselineValues = [];
    let preprocessedValues = [];
    let notes = '';

    // ── Baseline ──────────────────────────────────────────────────────────────
    try {
      const t0 = Date.now();
      const result = await worker.recognize(samplePath);
      const tokens = convertResultToTokens(result);
      const detections = detectAadhaar(tokens);
      baselineHit = detections.length > 0;
      baselineValues = detections.map(d => d.value);
      const elapsed = Date.now() - t0;
      console.log(`  baseline ${sample}: ${baselineHit ? 'HIT' : 'MISS'} (${detections.length} detections, ${elapsed}ms)`);
    } catch (e) {
      notes += `baseline-err:${e.message.slice(0,60)}; `;
      console.error(`  baseline ERROR ${sample}: ${e.message}`);
    }

    // ── Preprocess ────────────────────────────────────────────────────────────
    try {
      const pyResult = spawnSync('python3', [PREPROCESS_SCRIPT, samplePath, tmpPng], { timeout: 60000 });
      if (pyResult.status !== 0) {
        throw new Error(`python3 exit ${pyResult.status}: ${pyResult.stderr.toString().slice(0,100)}`);
      }
    } catch (e) {
      notes += `preprocess-err:${e.message.slice(0,60)}; `;
      console.error(`  preprocess ERROR ${sample}: ${e.message}`);
      appendReport(`| ${shortName} | ${baselineHit ? 'HIT' : 'MISS'} | ERROR | ${notes} |`);
      results.push({ sample, baselineHit, preprocessedHit: false, baselineValues, preprocessedValues, notes });
      continue;
    }

    try {
      const t1 = Date.now();
      const result2 = await worker.recognize(tmpPng);
      const tokens2 = convertResultToTokens(result2);
      const detections2 = detectAadhaar(tokens2);
      preprocessedHit = detections2.length > 0;
      preprocessedValues = detections2.map(d => d.value);
      const elapsed = Date.now() - t1;
      console.log(`  preprocessed ${sample}: ${preprocessedHit ? 'HIT' : 'MISS'} (${detections2.length} detections, ${elapsed}ms)`);
    } catch (e) {
      notes += `ocr2-err:${e.message.slice(0,60)}; `;
      console.error(`  ocr2 ERROR ${sample}: ${e.message}`);
    }

    const flipNote = baselineHit !== preprocessedHit
      ? (preprocessedHit ? 'MISS→HIT' : 'HIT→MISS')
      : '';
    const detectionNote = [
      baselineValues.length ? `baseline:${baselineValues.join(',')}` : '',
      preprocessedValues.length ? `prep:${preprocessedValues.join(',')}` : '',
    ].filter(Boolean).join(' ');

    const fullNote = [flipNote, detectionNote, notes].filter(Boolean).join('; ');
    appendReport(`| ${shortName} | ${baselineHit ? 'HIT' : 'MISS'} | ${preprocessedHit ? 'HIT' : 'MISS'} | ${fullNote} |`);
    results.push({ sample, baselineHit, preprocessedHit, baselineValues, preprocessedValues, notes });
  }

  await worker.terminate();

  // ── Aggregate ─────────────────────────────────────────────────────────────
  const baselineTotal = results.filter(r => r.baselineHit).length;
  const preprocessedTotal = results.filter(r => r.preprocessedHit).length;
  const total = results.length;
  const flippedUp = results.filter(r => !r.baselineHit && r.preprocessedHit);
  const flippedDown = results.filter(r => r.baselineHit && !r.preprocessedHit);

  appendReport('');
  appendReport('---');
  appendReport('');
  appendReport('## Aggregate');
  appendReport('');
  appendReport(`Baseline: **${baselineTotal}/${total}**`);
  appendReport(`Preprocessed: **${preprocessedTotal}/${total}**`);
  appendReport(`Delta: **${preprocessedTotal >= baselineTotal ? '+' : ''}${preprocessedTotal - baselineTotal}** samples`);
  appendReport('');
  if (flippedUp.length > 0) {
    appendReport(`MISS→HIT (preprocessor helped): ${flippedUp.map(r => r.sample).join(', ')}`);
  }
  if (flippedDown.length > 0) {
    appendReport(`HIT→MISS (preprocessor hurt): ${flippedDown.map(r => r.sample).join(', ')}`);
  }
  appendReport('');
  appendReport('*(PDFs excluded from this spike — require rasterization step not in scope)*');

  // ── Eyeball section ──────────────────────────────────────────────────────
  appendReport('');
  appendReport('---');
  appendReport('');
  appendReport('## Eyeball Section (per feedback_verify_detector_output.md)');
  appendReport('');
  appendReport('For each sample that flipped MISS→HIT, documenting what value was detected and whether it could be a false positive on non-Aadhaar text.');
  appendReport('');

  for (const r of flippedUp) {
    appendReport(`### ${r.sample} (MISS→HIT)`);
    appendReport(`Detected values: ${r.preprocessedValues.join(', ')}`);
    appendReport(`Verhoeff validation: all pass (enforced by isValidVerhoeff in harness)`);
    appendReport(`FP risk assessment: Verhoeff reduces random-12-digit FP rate to ~1/10. Value(s) above should be eyeballed against actual document.`);
    appendReport('');
  }
  for (const r of flippedDown) {
    appendReport(`### ${r.sample} (HIT→MISS) — preprocessor HURT this sample`);
    appendReport(`Baseline detected: ${r.baselineValues.join(', ')}`);
    appendReport(`Preprocessed detected: none`);
    appendReport(`Note: Over-contrast (CLAHE) may have destroyed fine digit strokes.`);
    appendReport('');
  }
  if (flippedUp.length === 0 && flippedDown.length === 0) {
    appendReport('No samples flipped — baseline and preprocessed produced identical results.');
    appendReport('');
  }

  // ── Recommendation ────────────────────────────────────────────────────────
  appendReport('---');
  appendReport('');
  appendReport('## Recommendation');
  appendReport('');

  const delta = preprocessedTotal - baselineTotal;
  if (delta > 1 && flippedDown.length === 0) {
    appendReport(`**SHIP** — preprocessor raised recall ${baselineTotal}/${total} → ${preprocessedTotal}/${total} with no regressions on image samples. Verify flipped values are true positives before merging.`);
  } else if (delta > 0 && flippedDown.length === 0) {
    appendReport(`**SHIP-WITH-CAVEATS** — preprocessor raised recall by +${delta} on image samples only. No regressions. PDF recall untested (out of scope). Verify flipped values are true positives.`);
  } else if (delta === 0) {
    appendReport(`**NEED-MORE-DATA** — preprocessor showed no recall change on ${total} image samples. PDFs (${SAMPLES.length < 13 ? 13 - SAMPLES.length : 0} excluded) may tell a different story. Consider running on rasterized PDF pages.`);
  } else if (delta > 0 && flippedDown.length > 0) {
    appendReport(`**SHIP-WITH-CAVEATS** — preprocessor raised recall by +${delta} net but regressed ${flippedDown.length} sample(s). Investigate regressed samples before shipping.`);
  } else {
    appendReport(`**DON'T-SHIP** — preprocessor did not improve recall (delta=${delta}, regressions=${flippedDown.length}).`);
  }

  appendReport('');
  appendReport('*PDFs require rasterization (pdf.js) which is out of scope for this spike. The 3 PDF samples were excluded.*');
  appendReport('');
  appendReport(`---`);
  appendReport(`*Spike completed: ${new Date().toISOString()}*`);

  console.log(`\nDone. Baseline: ${baselineTotal}/${total}, Preprocessed: ${preprocessedTotal}/${total}, Delta: ${delta >= 0 ? '+' : ''}${delta}`);
}

main().catch(e => {
  console.error('FATAL:', e);
  appendReport(`\n**FATAL ERROR:** ${e.message}`);
  process.exit(1);
});
