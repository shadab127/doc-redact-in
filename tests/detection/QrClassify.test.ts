/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Detection } from '@/src/detection/types';

/**
 * Classification is embedded inside createQrDetectorRunner(). To exercise it
 * without loading zxing-wasm we stub the dynamic import so the zxing module
 * returns hand-crafted barcode results, then assert on the Detection.kind the
 * runner produces.
 */
vi.mock('zxing-wasm', () => {
  type StubQueue = Array<{ text: string; format: string; position: unknown }>;
  const queue: StubQueue = [];
  return {
    __setStubResults(results: StubQueue) {
      queue.length = 0;
      queue.push(...results);
    },
    readBarcodesFromImageData: async () => queue.slice(),
  };
});

import * as zxingMock from 'zxing-wasm';
import { createQrDetectorRunner } from '@/src/detection/QrDetector';

function fakeCanvas(w = 500, h = 500): HTMLCanvasElement {
  const ctx = {
    drawImage: vi.fn(),
    getImageData: () => new ImageData(w, h),
  } as unknown as CanvasRenderingContext2D;
  return {
    width: w,
    height: h,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
}

function pos() {
  return {
    topLeft: { x: 10, y: 10 },
    topRight: { x: 110, y: 10 },
    bottomLeft: { x: 10, y: 110 },
    bottomRight: { x: 110, y: 110 },
  };
}

function setStubs(results: Array<{ text: string }>) {
  const full = results.map((r) => ({
    text: r.text,
    format: 'QRCode',
    position: pos(),
  }));
  (zxingMock as unknown as { __setStubResults: (r: typeof full) => void }).__setStubResults(full);
}

describe('QR classification', () => {
  if (typeof ImageData === 'undefined') {
    (globalThis as { ImageData?: unknown }).ImageData = class {
      width: number;
      height: number;
      data: Uint8ClampedArray;
      constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
        this.data = new Uint8ClampedArray(w * h * 4);
      }
    };
  }

  it('classifies a <?xml XML-prefix QR as uidai_qr', async () => {
    setStubs([{ text: '<?xml version="1.0"?><PrintLetterBarcodeData name="..."/>' }]);
    const runner = createQrDetectorRunner();
    const out: Detection[] = await runner.detect(fakeCanvas());
    expect(out[0]!.kind).toBe('uidai_qr');
  });

  it('classifies a PrintLetterBarcodeData marker as uidai_qr', async () => {
    setStubs([{ text: 'PrintLetterBarcodeData name="RAHUL"' }]);
    const runner = createQrDetectorRunner();
    const out = await runner.detect(fakeCanvas());
    expect(out[0]!.kind).toBe('uidai_qr');
  });

  it('classifies a large encrypted blob as uidai_qr (secure-QR heuristic)', async () => {
    setStubs([{ text: 'A'.repeat(1500) }]);
    const runner = createQrDetectorRunner();
    const out = await runner.detect(fakeCanvas());
    expect(out[0]!.kind).toBe('uidai_qr');
  });

  it('classifies a short non-UIDAI payload as other_qr', async () => {
    setStubs([{ text: 'https://example.com' }]);
    const runner = createQrDetectorRunner();
    const out = await runner.detect(fakeCanvas());
    expect(out[0]!.kind).toBe('other_qr');
  });
});
