/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { applyOtsu, toGrayscale } from './ImagePreprocessor';
import type { Detection, DetectionKind } from './types';

export interface QrDetectorRunner {
  detect(canvas: HTMLCanvasElement | ImageBitmap): Promise<Detection[]>;
}

export interface QrPosition {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
}

export interface ZxingResult {
  text: string;
  format: string;
  position?: QrPosition;
}

interface ZxingModule {
  readBarcodes(
    img: ImageData,
    opts: { tryHarder: boolean; formats: string[] }
  ): Promise<ZxingResult[]>;
}

interface ZxingV3Api {
  prepareZXingModule(options: {
    overrides: { locateFile: (p: string, prefix: string) => string };
    fireImmediately: true;
  }): Promise<unknown>;
}

async function loadZxing(): Promise<ZxingModule> {
  const mod = (await import('zxing-wasm')) as unknown as ZxingModule & ZxingV3Api;
  // Redirect the lazy WASM fetch from the upstream jsdelivr CDN to our own
  // origin. Required to keep CSP's connect-src 'self' intact and to preserve
  // the "nothing leaves your device" privacy invariant.
  //
  // `fireImmediately: true` actually instantiates the WASM module up front.
  // Without it the module loads on the first readBarcodes() call, which on
  // slow (mobile/cellular) connections races with the caller and throws
  // "Cannot read properties of undefined (reading 'buffer')" deep inside
  // Emscripten when the call arrives before the buffer is ready.
  await mod.prepareZXingModule({
    overrides: {
      locateFile: (filePath) => `/vendor/zxing/${filePath}`,
    },
    fireImmediately: true,
  });
  return mod;
}

// Legacy UIDAI QRs carry XML starting with <PrintLetterBarcodeData>.
// Secure UIDAI QRs (rolled out from 2019 onwards) carry an encrypted
// numeric/base64 blob ~1.5–2.5 KB long with no XML markers. We therefore
// treat any QR ≥ UIDAI_SECURE_QR_MIN_PAYLOAD chars as a probable UIDAI QR
// and auto-mask it; this favours a false positive over leaving real Aadhaar
// QRs unmasked. Real-world non-UIDAI QRs (envelopes, packaging) are
// typically URLs well under 200 chars, so collisions are rare.
const UIDAI_SECURE_QR_MIN_PAYLOAD = 500;

export function classifyQrPayload(payload: string): DetectionKind {
  if (payload.includes('<?xml')) return 'uidai_qr';
  if (payload.includes('PrintLetterBarcodeData')) return 'uidai_qr';
  if (payload.length >= UIDAI_SECURE_QR_MIN_PAYLOAD) return 'uidai_qr';
  return 'other_qr';
}

function positionToBbox(pos: QrPosition) {
  const xs = [pos.topLeft.x, pos.topRight.x, pos.bottomLeft.x, pos.bottomRight.x];
  const ys = [pos.topLeft.y, pos.topRight.y, pos.bottomLeft.y, pos.bottomRight.y];
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    w: Math.max(...xs) - x,
    h: Math.max(...ys) - y,
  };
}

export function createQrDetectorRunner(): QrDetectorRunner {
  let mod: Promise<ZxingModule> | null = null;

  return {
    async detect(canvas) {
      const zxing = await (mod ??= loadZxing());
      const imgData = canvasToImageData(canvas);
      const results = await zxing.readBarcodes(imgData, {
        tryHarder: true,
        formats: ['QRCode'],
      });
      return results
        .filter((r) => !!r.position)
        .map<Detection>((r) => {
          const bbox = positionToBbox(r.position!);
          return {
            kind: classifyQrPayload(r.text),
            bbox,
            maskBbox: bbox,
            value: r.text,
            confidence: 1,
          };
        });
    },
  };
}

function canvasToImageData(src: HTMLCanvasElement | ImageBitmap): ImageData {
  const hasGetContext =
    typeof (src as HTMLCanvasElement).getContext === 'function';
  if (hasGetContext) {
    const c = src as HTMLCanvasElement;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable for QR scan');
    return ctx.getImageData(0, 0, c.width, c.height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable for QR scan');
  ctx.drawImage(src as ImageBitmap, 0, 0);
  return ctx.getImageData(0, 0, src.width, src.height);
}

export function createMockQrDetectorRunner(detections: Detection[]): QrDetectorRunner {
  return { detect: async () => detections };
}

function iouBbox(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (inter === 0) return 0;
  const union = a.w * a.h + b.w * b.h - inter;
  return inter / union;
}

/**
 * Compose multiple QR runners into one that fans out in parallel and
 * deduplicates overlapping detections. Same IoU-merge pattern the face
 * detector uses to combine BlazeFace short-range + full-range: each
 * algorithm catches things the other misses; union gives recall lift
 * without double-masking a single real QR.
 *
 * If two runners agree on a QR (IoU > mergeIoU), we keep the first
 * runner's detection — the primary (zxing) is passed first so its
 * bbox/value stays authoritative on overlap.
 */
export function composeQrRunners(
  runners: QrDetectorRunner[],
  mergeIoU = 0.3
): QrDetectorRunner {
  return {
    async detect(canvas) {
      const results = await Promise.all(runners.map((r) => r.detect(canvas)));
      const merged: Detection[] = [];
      for (const batch of results) {
        for (const det of batch) {
          const duplicate = merged.some((m) => iouBbox(m.bbox, det.bbox) > mergeIoU);
          if (!duplicate) merged.push(det);
        }
      }
      return merged;
    },
  };
}

export type CanvasPreprocessor = (
  source: HTMLCanvasElement | ImageBitmap
) => HTMLCanvasElement | null;

/**
 * Wrap a QR runner so that on zero decodes the source canvas is run through
 * `preprocess` and the inner runner is retried. Fallback-only — never
 * changes behaviour when the first pass already decoded a QR.
 */
export function createPreprocessFallbackRunner(
  inner: QrDetectorRunner,
  preprocess: CanvasPreprocessor
): QrDetectorRunner {
  return {
    async detect(canvas) {
      const first = await inner.detect(canvas);
      if (first.length > 0) return first;
      const prepped = preprocess(canvas);
      if (!prepped) return first;
      return inner.detect(prepped);
    },
  };
}

/**
 * Render a canvas as a binarised (Otsu-threshold) black-and-white copy.
 * Intended as a QR decode-fallback: phone photos of laminated cards sometimes
 * have enough glare/gradient to defeat zxing's adaptive binariser, but a
 * clean 1-bit image from an upfront Otsu pass gives it a second chance.
 */
export function otsuBinarizedCanvas(
  source: HTMLCanvasElement | ImageBitmap
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const w = source.width;
  const h = source.height;
  if (!w || !h) return null;
  const src = document.createElement('canvas');
  src.width = w;
  src.height = h;
  const srcCtx = src.getContext('2d');
  if (!srcCtx) return null;
  srcCtx.drawImage(source, 0, 0);
  let imageData: ImageData;
  try {
    imageData = srcCtx.getImageData(0, 0, w, h);
  } catch {
    return null;
  }
  const gray = toGrayscale(imageData.data);
  const binary = applyOtsu(gray);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const outCtx = out.getContext('2d');
  if (!outCtx) return null;
  outCtx.putImageData(new ImageData(binary, w, h), 0, 0);
  return out;
}

/**
 * Upscale a canvas by an integer factor using bilinear filtering (browser
 * default). Intended as a QR decode-fallback for small phone shots like
 * sample-a1.jpg (636x400) where zxing's finder-pattern localisation
 * struggles at small scales.
 */
export function upscaleCanvas(
  source: HTMLCanvasElement | ImageBitmap,
  factor = 2
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const w = source.width;
  const h = source.height;
  if (!w || !h) return null;
  const out = document.createElement('canvas');
  out.width = w * factor;
  out.height = h * factor;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}
