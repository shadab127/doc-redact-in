/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { classifyQrPayload, type QrDetectorRunner } from './QrDetector';
import type { Detection } from './types';

interface JsqrPoint {
  x: number;
  y: number;
}

interface JsqrLocation {
  topLeftCorner: JsqrPoint;
  topRightCorner: JsqrPoint;
  bottomLeftCorner: JsqrPoint;
  bottomRightCorner: JsqrPoint;
}

interface JsqrCode {
  data: string;
  location: JsqrLocation;
}

type JsqrFn = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: 'attemptBoth' | 'dontInvert' | 'onlyInvert' | 'invertFirst' }
) => JsqrCode | null;

async function loadJsqr(): Promise<JsqrFn> {
  // Dynamic import keeps jsqr out of the initial bundle; it lands only on
  // first QR-bearing file drop, same lazy pattern as face-api/zxing.
  const mod = (await import('jsqr')) as unknown as { default: JsqrFn };
  return mod.default;
}

function locationToBbox(loc: JsqrLocation) {
  const xs = [
    loc.topLeftCorner.x,
    loc.topRightCorner.x,
    loc.bottomLeftCorner.x,
    loc.bottomRightCorner.x,
  ];
  const ys = [
    loc.topLeftCorner.y,
    loc.topRightCorner.y,
    loc.bottomLeftCorner.y,
    loc.bottomRightCorner.y,
  ];
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    w: Math.max(...xs) - x,
    h: Math.max(...ys) - y,
  };
}

function canvasToImageData(src: HTMLCanvasElement | ImageBitmap): ImageData {
  const hasGetContext = typeof (src as HTMLCanvasElement).getContext === 'function';
  if (hasGetContext) {
    const c = src as HTMLCanvasElement;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable for jsQR scan');
    return ctx.getImageData(0, 0, c.width, c.height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable for jsQR scan');
  ctx.drawImage(src as ImageBitmap, 0, 0);
  return ctx.getImageData(0, 0, src.width, src.height);
}

/**
 * Pure-JS QR decoder (~45 KB gz) used alongside zxing-wasm. zxing and jsQR
 * use different algorithms (finder-pattern-first vs image-segmentation +
 * find-squares) and their misses don't fully overlap — running both in
 * parallel and union-merging the results lifts recall on the phone-photo
 * failure class without breaking the happy path.
 *
 * Shape matches `QrDetectorRunner` so the orchestrator can compose it with
 * the existing zxing runner via the same merge path used for face models.
 */
export function createJsqrDetectorRunner(): QrDetectorRunner {
  let fn: Promise<JsqrFn> | null = null;

  return {
    async detect(canvas) {
      const jsQR = await (fn ??= loadJsqr());
      const imgData = canvasToImageData(canvas);
      // attemptBoth is necessary for printed Aadhaar QRs on dark
      // backgrounds (WhatsApp phone shots); inverting frequently unlocks
      // a decode zxing misses.
      const result = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'attemptBoth',
      });
      // jsQR has a failure mode on noisy images where it returns a location
      // with an empty or single-char data payload. These are not real QRs —
      // treat them as misses. Without this guard the composer would mask a
      // noise-driven region and classify it as `other_qr` (short payload).
      if (!result || !result.data || result.data.length < 8) return [];
      const bbox = locationToBbox(result.location);
      const detection: Detection = {
        kind: classifyQrPayload(result.data),
        bbox,
        maskBbox: bbox,
        value: result.data,
        confidence: 1,
      };
      return [detection];
    },
  };
}
