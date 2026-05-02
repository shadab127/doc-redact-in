/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
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
  readBarcodesFromImageData(
    img: ImageData,
    opts: { tryHarder: boolean; formats: string[] }
  ): Promise<ZxingResult[]>;
}

async function loadZxing(): Promise<ZxingModule> {
  return (await import('zxing-wasm')) as unknown as ZxingModule;
}

// Legacy UIDAI QRs carry XML starting with <PrintLetterBarcodeData>.
// Secure UIDAI QRs (rolled out from 2019 onwards) carry an encrypted
// numeric/base64 blob ~1.5–2.5 KB long with no XML markers. We therefore
// treat any QR ≥ UIDAI_SECURE_QR_MIN_PAYLOAD chars as a probable UIDAI QR
// and auto-mask it; this favours a false positive over leaving real Aadhaar
// QRs unmasked. Real-world non-UIDAI QRs (envelopes, packaging) are
// typically URLs well under 200 chars, so collisions are rare.
const UIDAI_SECURE_QR_MIN_PAYLOAD = 500;

function classify(payload: string): DetectionKind {
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
      const results = await zxing.readBarcodesFromImageData(imgData, {
        tryHarder: true,
        formats: ['QRCode'],
      });
      return results
        .filter((r) => !!r.position)
        .map<Detection>((r) => {
          const bbox = positionToBbox(r.position!);
          return {
            kind: classify(r.text),
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
