// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runDetectionOnDocument, type PdfPipeline } from '@/src/detection/DetectionOrchestrator';
import { verhoeffCheckDigit } from '@/src/detection/Verhoeff';
import type { OCRToken } from '@/src/detection/types';

const body = '12345678901';
const value = body + verhoeffCheckDigit(body);

class TestCanvas {
  width = 1000;
  height = 600;
  __bandOrigin?: { x: number; y: number; scale: number };
  getContext() { return { drawImage: vi.fn() }; }
}

function triplet(y: number, lineId: number): OCRToken[] {
  return [0, 1, 2].map((i) => ({
    text: value.slice(i * 4, i * 4 + 4),
    bbox: { x: 20 + i * 50, y, w: 40, h: 20 }, confidence: 0.95, lineId,
  }));
}

const suspicious: OCRToken = {
  text: value, bbox: { x: 20, y: 50, w: 700, h: 20 }, confidence: 0.95, lineId: 0,
};

afterEach(() => vi.unstubAllGlobals());

async function run(kind: string, initial: OCRToken[], recoveredRows: number[], inline = false) {
  vi.stubGlobal('HTMLCanvasElement', TestCanvas);
  vi.stubGlobal('document', { createElement: () => new TestCanvas() });
  const canvas = new TestCanvas() as unknown as HTMLCanvasElement;
  const ocr = {
    async recognize(input: unknown) {
      const band = input as TestCanvas;
      if (!band.__bandOrigin) return initial;
      const origin = band.__bandOrigin.y;
      return recoveredRows.filter((y) => y >= origin && y + 20 <= origin + band.height)
        .flatMap((y, i) => inline ? [{
          text: value, bbox: { x: 600, y: y - origin, w: 120, h: 20 }, confidence: 0.95, lineId: i,
        }] : triplet(y - origin, i));
    },
    async terminate() {},
  };
  const pipeline = (): PdfPipeline => ({
    load: async () => ({ numPages: 1, pageSizesPt: [{ width: 333, height: 200 }] }),
    rasterize: async () => ({ pageIndex: 0, canvas, width: 1000, height: 600 }),
    destroy: async () => {},
  });
  const input = kind === 'pdf' ? new Blob(['synthetic'], { type: 'application/pdf' }) : canvas;
  const result = await runDetectionOnDocument(input, { ocr, pdfPipeline: pipeline });
  return result.pages[0]!.detections.filter((d) => d.kind === 'aadhaar');
}

describe.each(['image', 'pdf'])('spatial Aadhaar recovery: %s', (kind) => {
  it('never replaces a suspicious occurrence with a clean occurrence elsewhere', async () => {
    const detections = await run(kind, [suspicious, ...triplet(400, 1)], [400]);
    expect(detections.map((d) => d.maskBbox.y).sort((a, b) => a - b)).toEqual([50, 400]);
    expect(detections.find((d) => d.bbox.y === 50)?.suspicious).toBe(true);
  });

  it('replaces only the overlapping occurrence and deduplicates repeated band hits', async () => {
    const detections = await run(kind, [suspicious, ...triplet(400, 1)], [50, 400]);
    expect(detections.map((d) => d.maskBbox.y).sort((a, b) => a - b)).toEqual([50, 400]);
    expect(detections.every((d) => !d.suspicious)).toBe(true);
    expect(detections.every((d) => d.maskBbox.w === 90)).toBe(true);
  });

  it('replaces a suspicious inline hit with a clean single-token band result', async () => {
    const detections = await run(kind, [suspicious], [50], true);
    expect(detections).toHaveLength(1);
    expect(detections[0]!.suspicious).not.toBe(true);
    expect(detections[0]!.maskBbox).toEqual({ x: 600, y: 50, w: 80, h: 20 });
  });

  it('keeps a separate occurrence while replacing a suspicious inline hit', async () => {
    const detections = await run(kind, [suspicious, ...triplet(400, 1)], [50], true);
    expect(detections).toHaveLength(2);
    expect(detections.find((d) => d.bbox.y === 50)?.maskBbox.x).toBe(600);
    expect(detections.every((d) => !d.suspicious)).toBe(true);
  });

  it('accumulates different occurrences recovered from different bands', async () => {
    const detections = await run(kind, [], [50, 400]);
    expect(detections.map((d) => d.maskBbox.y).sort((a, b) => a - b)).toEqual([50, 400]);
  });
});
