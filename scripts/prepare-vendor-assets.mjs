/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */

// Copy Tesseract.js + zxing-wasm vendor binaries into public/vendor/ so the
// app can load them from our own origin. This keeps connect-src 'self'
// intact (no jsdelivr.net in the CSP) and preserves the "nothing leaves your
// device" privacy property end-to-end.
//
// The English traineddata (~3 MB) isn't available as an npm package in the
// "best_int" variant we want, so we fetch it from jsdelivr once and cache it
// in public/vendor/. The file is committed to the repo — subsequent runs are
// offline.
//
// Idempotent: re-running is a no-op if every target already exists and is
// non-empty.

import { createHash } from 'node:crypto';
import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve('.');
const VENDOR = path.join(REPO, 'public', 'vendor');

const TESSERACT_LANG_URL =
  'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz';
// sha256 of the upstream file, pinned to catch silent CDN tampering. If the
// upstream rev is intentionally bumped, update this hash alongside.
const TESSERACT_LANG_SHA256 =
  '45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91';

// MediaPipe BlazeFace short-range model (float16, ~225 KB). Hosted by Google
// on storage.googleapis.com. We download once, pin by hash, and vendor under
// public/vendor/mediapipe/ so runtime never contacts Google.
const MEDIAPIPE_FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const MEDIAPIPE_FACE_MODEL_SHA256 =
  'b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f';

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

function isNonEmptyFile(p) {
  try {
    return statSync(p).size > 0;
  } catch {
    return false;
  }
}

async function copyNodeModule(fromRel, toRel) {
  const src = path.join(REPO, 'node_modules', fromRel);
  const dst = path.join(VENDOR, toRel);
  if (isNonEmptyFile(dst) || (existsSync(dst) && statSync(dst).isDirectory() && readdirSync(dst).length > 0)) {
    return { action: 'skip', dst };
  }
  await ensureDir(path.dirname(dst));
  await cp(src, dst, { recursive: true });
  return { action: 'copy', dst };
}

async function fetchWithHashCheck(url, dst, expectedSha256) {
  if (isNonEmptyFile(dst)) {
    return { action: 'skip', dst };
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = createHash('sha256').update(buf).digest('hex');
  if (expectedSha256 && got !== expectedSha256) {
    throw new Error(
      `prepare-vendor-assets: hash mismatch for ${url}\n  expected: ${expectedSha256}\n  got:      ${got}\nRefusing to write vendored asset. Update the pinned hash if the upstream rev change is intentional.`
    );
  }
  await ensureDir(path.dirname(dst));
  await writeFile(dst, buf);
  return { action: 'download', dst, sha256: got };
}

async function main() {
  await ensureDir(VENDOR);

  // zxing-wasm core
  const zxing = await copyNodeModule(
    'zxing-wasm/dist/full/zxing_full.wasm',
    'zxing/zxing_full.wasm'
  );
  console.log(`  zxing_full.wasm -> ${zxing.action}`);

  // pdf.js worker — loaded via GlobalWorkerOptions.workerSrc in PdfLoader.ts.
  // Without this, pdf.js throws "No GlobalWorkerOptions.workerSrc specified".
  const pdfWorker = await copyNodeModule(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    'pdfjs/pdf.worker.min.mjs'
  );
  console.log(`  pdfjs/pdf.worker.min.mjs -> ${pdfWorker.action}`);

  // pdf.js standard fonts — used as fallback for PDFs that reference fonts not
  // embedded in the file itself. Skipping cmaps/ since we don't target CJK.
  const pdfFonts = await copyNodeModule(
    'pdfjs-dist/standard_fonts',
    'pdfjs/standard_fonts'
  );
  console.log(`  pdfjs/standard_fonts/ -> ${pdfFonts.action}`);

  // tesseract.js browser worker
  const tessWorker = await copyNodeModule(
    'tesseract.js/dist/worker.min.js',
    'tesseract/worker.min.js'
  );
  console.log(`  tesseract/worker.min.js -> ${tessWorker.action}`);

  // tesseract.js-core — only the LSTM variants (we call createWorker('eng', 1)
  // which is LSTM_ONLY mode). Copy the two LSTM builds (SIMD + fallback) and
  // skip the 20+ MB of legacy-combined + full variants we never load.
  const coreFiles = [
    'tesseract-core-simd-lstm.wasm',
    'tesseract-core-simd-lstm.wasm.js',
    'tesseract-core-lstm.wasm',
    'tesseract-core-lstm.wasm.js',
    'package.json',
  ];
  for (const f of coreFiles) {
    const r = await copyNodeModule(
      `tesseract.js-core/${f}`,
      `tesseract-core/${f}`
    );
    console.log(`  tesseract-core/${f} -> ${r.action}`);
  }

  // English traineddata (lstm-only "best_int" variant matches createWorker('eng', 1))
  const lang = await fetchWithHashCheck(
    TESSERACT_LANG_URL,
    path.join(VENDOR, 'tesseract-lang', 'eng.traineddata.gz'),
    TESSERACT_LANG_SHA256
  );
  console.log(
    `  tesseract-lang/eng.traineddata.gz -> ${lang.action}${lang.sha256 ? ` (sha256=${lang.sha256})` : ''}`
  );

  // MediaPipe vision runtime + BlazeFace model. Replaces @vladmandic/face-api,
  // which used eval() internally and violated our strict CSP. MediaPipe is
  // pure WASM + tflite interpreter; no eval.
  //
  // We only need the SIMD variant of the runtime; the non-SIMD fallback is
  // kept so devices without WebAssembly SIMD can still run face detection.
  // The "module_internal" variant is the ES-module build we don't use.
  const mpFiles = [
    'vision_wasm_internal.wasm',
    'vision_wasm_internal.js',
    'vision_wasm_nosimd_internal.wasm',
    'vision_wasm_nosimd_internal.js',
  ];
  for (const f of mpFiles) {
    const r = await copyNodeModule(
      `@mediapipe/tasks-vision/wasm/${f}`,
      `mediapipe/${f}`
    );
    console.log(`  mediapipe/${f} -> ${r.action}`);
  }

  const mpModel = await fetchWithHashCheck(
    MEDIAPIPE_FACE_MODEL_URL,
    path.join(VENDOR, 'mediapipe', 'blaze_face_short_range.tflite'),
    MEDIAPIPE_FACE_MODEL_SHA256
  );
  console.log(
    `  mediapipe/blaze_face_short_range.tflite -> ${mpModel.action}${mpModel.sha256 ? ` (sha256=${mpModel.sha256})` : ''}`
  );

  // Surface the total footprint so regressions (accidental bloat) are visible
  // in build logs.
  const total = await walkSize(VENDOR);
  console.log(`  total public/vendor/ size: ${(total / 1024 / 1024).toFixed(2)} MB`);
}

async function walkSize(dir) {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) n += await walkSize(full);
    else n += (await stat(full)).size;
  }
  return n;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
