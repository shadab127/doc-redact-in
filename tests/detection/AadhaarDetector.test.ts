/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';
import { detectAadhaar } from '@/src/detection/AadhaarDetector';
import { verhoeffCheckDigit } from '@/src/detection/Verhoeff';
import type { OCRToken } from '@/src/detection/types';

function mkBody(seed: number): string {
  let x = (seed * 2654435761) >>> 0;
  let s = '';
  for (let i = 0; i < 11; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    s += String((x >>> 16) % 10);
  }
  return s;
}

function mkValidAadhaar(seed: number): string {
  const body = mkBody(seed);
  return body + String(verhoeffCheckDigit(body));
}

function tok(
  text: string,
  x: number,
  lineId: number,
  opts: Partial<OCRToken> = {}
): OCRToken {
  return {
    text,
    bbox: { x, y: 100, w: text.length * 10, h: 20 },
    confidence: 0.95,
    lineId,
    ...opts,
  };
}

describe('detectAadhaar', () => {
  it('detects a valid Aadhaar across three tokens on one line', () => {
    const aadhaar = mkValidAadhaar(42);
    const [g1, g2, g3] = [aadhaar.slice(0, 4), aadhaar.slice(4, 8), aadhaar.slice(8, 12)];
    const tokens: OCRToken[] = [tok(g1!, 10, 0), tok(g2!, 60, 0), tok(g3!, 110, 0)];
    const result = detectAadhaar(tokens);
    expect(result).toHaveLength(1);
    expect(result[0]!.value).toBe(aadhaar);
    expect(result[0]!.kind).toBe('aadhaar');
  });

  it('rejects 12 digits with invalid Verhoeff check digit', () => {
    const aadhaar = mkValidAadhaar(7);
    const badLast = String((Number(aadhaar[11]) + 1) % 10);
    const tampered = aadhaar.slice(0, 11) + badLast;
    const tokens: OCRToken[] = [
      tok(tampered.slice(0, 4), 10, 0),
      tok(tampered.slice(4, 8), 60, 0),
      tok(tampered.slice(8, 12), 110, 0),
    ];
    expect(detectAadhaar(tokens)).toEqual([]);
  });

  it('bbox union covers all three groups; maskBbox excludes last group', () => {
    const aadhaar = mkValidAadhaar(101);
    const tokens: OCRToken[] = [
      tok(aadhaar.slice(0, 4), 10, 0),
      tok(aadhaar.slice(4, 8), 60, 0),
      tok(aadhaar.slice(8, 12), 110, 0),
    ];
    const [d] = detectAadhaar(tokens);
    expect(d).toBeDefined();
    expect(d!.bbox.x).toBe(10);
    const fullRight = d!.bbox.x + d!.bbox.w;
    const maskRight = d!.maskBbox.x + d!.maskBbox.w;
    expect(maskRight).toBeLessThan(fullRight);
    expect(d!.maskBbox.x).toBe(10);
  });

  it('ignores 12 digits not structured as 4-4-4 on a line', () => {
    const aadhaar = mkValidAadhaar(5);
    const tokens: OCRToken[] = [
      tok(aadhaar.slice(0, 3), 10, 0),
      tok(aadhaar.slice(3, 7), 60, 0),
      tok(aadhaar.slice(7, 12), 110, 0),
    ];
    expect(detectAadhaar(tokens)).toEqual([]);
  });

  it('detects an inline "XXXX XXXX XXXX" match inside a single token', () => {
    const aadhaar = mkValidAadhaar(77);
    const formatted = `${aadhaar.slice(0, 4)} ${aadhaar.slice(4, 8)} ${aadhaar.slice(8, 12)}`;
    const tokens: OCRToken[] = [tok(formatted, 10, 0)];
    const result = detectAadhaar(tokens);
    expect(result).toHaveLength(1);
    expect(result[0]!.value).toBe(aadhaar);
  });

  it('does not detect any Aadhaar when no Verhoeff-valid candidate exists', () => {
    const tokens: OCRToken[] = [
      tok('0000', 10, 0),
      tok('0000', 60, 0),
      tok('0000', 110, 0),
    ];
    expect(detectAadhaar(tokens)).toEqual([]);
  });

  it('inline hyphen-separated match masks only the first 8 digits', () => {
    const aadhaar = mkValidAadhaar(33);
    const formatted = `${aadhaar.slice(0, 4)}-${aadhaar.slice(4, 8)}-${aadhaar.slice(8, 12)}`;
    const tokens: OCRToken[] = [tok(formatted, 20, 0)];
    const [d] = detectAadhaar(tokens);
    expect(d).toBeDefined();
    const fullRight = d!.bbox.x + d!.bbox.w;
    const maskRight = d!.maskBbox.x + d!.maskBbox.w;
    expect(maskRight).toBeLessThan(fullRight);
    // 8 digits + 1 hyphen = 9 chars of 14 total → ~64% of width.
    const ratio = d!.maskBbox.w / d!.bbox.w;
    expect(ratio).toBeGreaterThan(0.55);
    expect(ratio).toBeLessThan(0.75);
  });

  it('triplet path still fires when the last group has trailing punctuation', () => {
    const aadhaar = mkValidAadhaar(11);
    const tokens: OCRToken[] = [
      tok(aadhaar.slice(0, 4), 10, 0),
      tok(aadhaar.slice(4, 8), 60, 0),
      tok(`${aadhaar.slice(8, 12)}-`, 110, 0),
    ];
    const result = detectAadhaar(tokens);
    expect(result).toHaveLength(1);
    expect(result[0]!.value).toBe(aadhaar);
  });

  it('keeps both detections when the same number appears in two spatially separate lines', () => {
    const aadhaar = mkValidAadhaar(55);
    const formatted = `${aadhaar.slice(0, 4)} ${aadhaar.slice(4, 8)} ${aadhaar.slice(8, 12)}`;
    const tokens: OCRToken[] = [
      tok(formatted, 20, 0, { bbox: { x: 20, y: 100, w: 140, h: 20 } }),
      tok(formatted, 20, 1, { bbox: { x: 20, y: 400, w: 140, h: 20 } }),
    ];
    const result = detectAadhaar(tokens);
    expect(result).toHaveLength(2);
    expect(result[0]!.value).toBe(aadhaar);
    expect(result[1]!.value).toBe(aadhaar);
  });

  it('collapses the triplet and inline paths when both fire on the same physical row', () => {
    const aadhaar = mkValidAadhaar(91);
    const formatted = `${aadhaar.slice(0, 4)} ${aadhaar.slice(4, 8)} ${aadhaar.slice(8, 12)}`;
    const tokens: OCRToken[] = [
      tok(aadhaar.slice(0, 4), 10, 0, { bbox: { x: 10, y: 100, w: 40, h: 20 } }),
      tok(aadhaar.slice(4, 8), 60, 0, { bbox: { x: 60, y: 100, w: 40, h: 20 } }),
      tok(aadhaar.slice(8, 12), 110, 0, { bbox: { x: 110, y: 100, w: 40, h: 20 } }),
      tok(formatted, 10, 0, { bbox: { x: 10, y: 100, w: 140, h: 20 } }),
    ];
    const result = detectAadhaar(tokens);
    expect(result).toHaveLength(1);
  });

  it('flags inline detection as suspicious when per-char width exceeds line height', () => {
    const aadhaar = mkValidAadhaar(12);
    // 12-char token "802503055552" in a 730x44 bbox. Per-char = 730/(12*44) ≈
    // 1.38 — above the 1.3 upper bound, signalling a hallucinated-wide bbox
    // (mimics Tesseract's output on the sample_8 front panel).
    const tokens: OCRToken[] = [
      tok(aadhaar, 10, 0, { bbox: { x: 38, y: 390, w: 730, h: 44 } }),
    ];
    const result = detectAadhaar(tokens);
    expect(result).toHaveLength(1);
    expect(result[0]!.suspicious).toBe(true);
  });

  it('does not flag inline detections with plausible per-char widths', () => {
    const aadhaar = mkValidAadhaar(13);
    const formatted = `${aadhaar.slice(0, 4)} ${aadhaar.slice(4, 8)} ${aadhaar.slice(8, 12)}`;
    // 14-char token in a 140x20 bbox. Per-char = 140/(14*20) = 0.5 — inside
    // the [0.4, 1.3] range, so not suspicious.
    const tokens: OCRToken[] = [
      tok(formatted, 10, 0, { bbox: { x: 10, y: 100, w: 140, h: 20 } }),
    ];
    const result = detectAadhaar(tokens);
    expect(result).toHaveLength(1);
    expect(result[0]!.suspicious).toBeUndefined();
  });
});
