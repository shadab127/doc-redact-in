// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flattenToImageOnlyPdf } from '@/src/masking/PdfFlattener';
import type { Detection } from '@/src/detection/types';

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    create: async () => ({
      embedJpg: async () => ({}),
      addPage: () => ({ drawImage: vi.fn() }),
      save: async () => new Uint8Array([37, 80, 68, 70]),
    }),
  },
}));

afterEach(() => { vi.unstubAllGlobals(); });

function fixture(failEncoding = false) {
  const encodedMasks: number[][][] = [];
  const outputs: HTMLCanvasElement[] = [];
  const sourceContext = vi.fn();
  const source = { width: 100, height: 80, getContext: sourceContext } as unknown as HTMLCanvasElement;
  vi.stubGlobal('document', {
    createElement: () => {
      const masks: number[][] = [];
      const ctx = { drawImage: vi.fn(), fillStyle: '', fillRect: (...args: number[]) => masks.push(args) };
      const canvas = {
        width: 0, height: 0,
        getContext: () => ctx,
        toBlob: (cb: BlobCallback) => {
          encodedMasks.push(masks.slice());
          cb(failEncoding ? null : new Blob(['jpeg']));
        },
      } as unknown as HTMLCanvasElement;
      outputs.push(canvas);
      return canvas;
    },
  });
  return { source, sourceContext, encodedMasks, outputs };
}

const detection: Detection = {
  kind: 'aadhaar', bbox: { x: 10, y: 10, w: 60, h: 10 },
  maskBbox: { x: 10, y: 10, w: 40, h: 10 }, value: 'synthetic', confidence: 1,
};

describe('non-mutating PDF export', () => {
  it('allows a second export with a detection turned off', async () => {
    const f = fixture();
    const page = { canvas: f.source, widthPt: 100, heightPt: 80 };
    await flattenToImageOnlyPdf([{ ...page, detections: [detection] }]);
    await flattenToImageOnlyPdf([{ ...page, detections: [] }]);
    expect(f.encodedMasks).toEqual([[[10, 10, 40, 10]], []]);
    expect(f.sourceContext).not.toHaveBeenCalled();
    expect([f.source.width, f.source.height]).toEqual([100, 80]);
    expect(f.outputs.every((c) => c.width === 0 && c.height === 0)).toBe(true);
  });

  it('does not retain deleted or moved manual boxes across exports', async () => {
    const f = fixture();
    const page = { canvas: f.source, widthPt: 100, heightPt: 80, detections: [] };
    await flattenToImageOnlyPdf([{ ...page, manualBoxes: [{ x: 1, y: 2, w: 3, h: 4 }] }]);
    await flattenToImageOnlyPdf([{ ...page, manualBoxes: [{ x: 20, y: 2, w: 3, h: 4 }] }]);
    await flattenToImageOnlyPdf([page]);
    expect(f.encodedMasks).toEqual([[[1, 2, 3, 4]], [[20, 2, 3, 4]], []]);
    expect(f.sourceContext).not.toHaveBeenCalled();
  });

  it('releases the temporary canvas after encoding fails', async () => {
    const f = fixture(true);
    await expect(flattenToImageOnlyPdf([{ canvas: f.source, widthPt: 100, heightPt: 80, detections: [detection] }])).rejects.toThrow('toBlob');
    expect(f.outputs[0]!.width).toBe(0);
    expect(f.sourceContext).not.toHaveBeenCalled();
  });
});
