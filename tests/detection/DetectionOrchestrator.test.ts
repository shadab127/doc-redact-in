/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';
import { runDetection } from '@/src/detection/DetectionOrchestrator';
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

  it('rejects PDF input with a clear error message', async () => {
    const ocr = createMockOCRRunner([]);
    const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    await expect(runDetection(pdf, { ocr })).rejects.toThrow(/PDF input not supported/);
  });
});
