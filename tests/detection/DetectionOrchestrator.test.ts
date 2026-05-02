/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';
import {
  runDetection,
  runDetectionOnDocument,
  type PdfPipeline,
} from '@/src/detection/DetectionOrchestrator';
import { createMockOCRRunner } from '@/src/detection/OCRRunner';
import { verhoeffCheckDigit } from '@/src/detection/Verhoeff';
import type { OCRToken } from '@/src/detection/types';

function mkValidAadhaar(): string {
  const body = '12345678901';
  return body + String(verhoeffCheckDigit(body));
}

function tok(text: string, x: number, lineId: number): OCRToken {
  return {
    text,
    bbox: { x, y: 10, w: text.length * 10, h: 20 },
    confidence: 0.9,
    lineId,
  };
}

describe('runDetection', () => {
  it('merges Aadhaar + PAN detections from mock OCR tokens', async () => {
    const aadhaar = mkValidAadhaar();
    const tokens: OCRToken[] = [
      tok(aadhaar.slice(0, 4), 10, 0),
      tok(aadhaar.slice(4, 8), 60, 0),
      tok(aadhaar.slice(8, 12), 110, 0),
      tok('ABCPE1234F', 10, 1),
    ];
    const ocr = createMockOCRRunner(tokens);

    const result = await runDetection(new Blob(), { ocr });
    const kinds = result.detections.map((d) => d.kind).sort();
    expect(kinds).toEqual(['aadhaar', 'pan']);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('returns empty detections when no PII tokens are present', async () => {
    const ocr = createMockOCRRunner([tok('Hello', 0, 0), tok('World', 60, 0)]);
    const result = await runDetection(new Blob(), { ocr });
    expect(result.detections).toEqual([]);
  });

  it('runDetection still rejects PDF and points to the document API', async () => {
    const ocr = createMockOCRRunner([]);
    const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    await expect(runDetection(pdf, { ocr })).rejects.toThrow(/runDetectionOnDocument/);
  });
});

describe('runDetectionOnDocument — PDF path (mocked pipeline)', () => {
  function fakeCanvas(): HTMLCanvasElement {
    return { width: 1000, height: 800 } as unknown as HTMLCanvasElement;
  }

  function mockPdfPipeline(pages: number): () => PdfPipeline {
    return () => ({
      load: async () => ({
        numPages: pages,
        pageSizesPt: Array.from({ length: pages }, () => ({ width: 595, height: 842 })),
      }),
      rasterize: async (pageIndex: number, _scale: number) => ({
        pageIndex,
        canvas: fakeCanvas(),
        width: 1000,
        height: 800,
      }),
      destroy: async () => {},
    });
  }

  it('returns a DocumentDetectionResult with one entry per page', async () => {
    const aadhaar = mkValidAadhaar();
    const tokens: OCRToken[] = [
      tok(aadhaar.slice(0, 4), 10, 0),
      tok(aadhaar.slice(4, 8), 60, 0),
      tok(aadhaar.slice(8, 12), 110, 0),
    ];
    const ocr = createMockOCRRunner(tokens);
    const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    const result = await runDetectionOnDocument(pdf, {
      ocr,
      pdfPipeline: mockPdfPipeline(3),
    });
    expect(result.sourceKind).toBe('pdf');
    expect(result.pages).toHaveLength(3);
    for (const p of result.pages) {
      expect(p.detections.some((d) => d.kind === 'aadhaar')).toBe(true);
    }
    expect(result.pageSizesPt).toHaveLength(3);
    expect(result.pageSizesPt?.[0]).toEqual({ width: 595, height: 842 });
  });

  it('invokes onRaster for each page in order', async () => {
    const ocr = createMockOCRRunner([]);
    const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    const seen: number[] = [];
    await runDetectionOnDocument(pdf, {
      ocr,
      pdfPipeline: mockPdfPipeline(2),
      onRaster: (_r, idx) => seen.push(idx),
    });
    expect(seen).toEqual([0, 1]);
  });

  it('rejects PDF without a pipeline factory', async () => {
    const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    await expect(runDetectionOnDocument(pdf, { ocr: createMockOCRRunner([]) })).rejects.toThrow(
      /pdfPipeline/
    );
  });

  it('wraps image input as a single-page document result', async () => {
    const ocr = createMockOCRRunner([tok('hello', 0, 0)]);
    const result = await runDetectionOnDocument(new Blob(), { ocr });
    expect(result.sourceKind).toBe('image');
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]!.pageIndex).toBe(0);
  });
});
