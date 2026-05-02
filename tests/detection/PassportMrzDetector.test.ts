/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';
import { detectPassportMrz } from '@/src/detection/PassportMrzDetector';
import type { OCRToken } from '@/src/detection/types';

function tok(text: string, x: number, lineId: number): OCRToken {
  return {
    text,
    bbox: { x, y: 100 + lineId * 40, w: text.length * 10, h: 30 },
    confidence: 0.9,
    lineId,
  };
}

// Line 1: "P<IND" (5 chars) + 39-char name field with A-Z/< padding = 44 chars total.
// Pad-count proof: "KUMAR<<ANAND" = 12 chars + 27 '<' filler = 39.
const MRZ_LINE_1 = 'P<INDKUMAR<<ANAND' + '<'.repeat(27);
// Line 2 = 9-char passport number field + check + IND + 6-digit DOB + check + sex + 6-digit expiry + check + 14-char personal + 2 check digits.
// "L8988901<" (9) + "1" + "IND" + "830808" (6) + "1" + "M" + "260101" (6) + "1" + 14 '<' + "02" = 44.
const MRZ_LINE_2 = 'L8988901<1IND8308081M2601011' + '<'.repeat(14) + '02';

describe('detectPassportMrz', () => {
  it('sanity: MRZ test strings are both 44 chars and regex-matching', () => {
    expect(MRZ_LINE_1.length).toBe(44);
    expect(MRZ_LINE_2.length).toBe(44);
  });

  it('detects a valid MRZ pair across two consecutive lines', () => {
    const tokens: OCRToken[] = [tok(MRZ_LINE_1, 10, 0), tok(MRZ_LINE_2, 10, 1)];
    const result = detectPassportMrz(tokens);
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('passport_mrz');
    expect(result[0]!.value).toBe(`${MRZ_LINE_1}\n${MRZ_LINE_2}`);
  });

  it('merges sub-tokens on the same line before matching', () => {
    const tokens: OCRToken[] = [
      tok(MRZ_LINE_1.slice(0, 22), 10, 0),
      tok(MRZ_LINE_1.slice(22), 230, 0),
      tok(MRZ_LINE_2, 10, 1),
    ];
    expect(detectPassportMrz(tokens)).toHaveLength(1);
  });

  it('rejects when line 1 starts with non-Indian country code', () => {
    const tokens: OCRToken[] = [
      tok('P<USAKUMAR<<ANAND<<<<<<<<<<<<<<<<<<<<<<<<', 10, 0),
      tok(MRZ_LINE_2, 10, 1),
    ];
    expect(detectPassportMrz(tokens)).toEqual([]);
  });

  it('rejects when line 2 does not contain IND in the right position', () => {
    const tokens: OCRToken[] = [
      tok(MRZ_LINE_1, 10, 0),
      tok('L8988901<1USA8308081M2601011<<<<<<<<<<<<<<02', 10, 1),
    ];
    expect(detectPassportMrz(tokens)).toEqual([]);
  });

  it('uppercases lowercase fragments before matching', () => {
    const lowerLine1 = 'p<indKUMAR<<ANAND' + '<'.repeat(27);
    const tokens: OCRToken[] = [tok(lowerLine1, 10, 0), tok(MRZ_LINE_2, 10, 1)];
    expect(detectPassportMrz(tokens)).toHaveLength(1);
  });

  it('strips whitespace inserted by Tesseract', () => {
    const spacedLine1 = 'P<IND KUMAR<<ANAND' + '<'.repeat(27); // 1 extra space
    const tokens: OCRToken[] = [tok(spacedLine1, 10, 0), tok(MRZ_LINE_2, 10, 1)];
    expect(detectPassportMrz(tokens)).toHaveLength(1);
  });

  it('returns empty when no valid line pair is present', () => {
    const tokens: OCRToken[] = [tok('Hello world', 10, 0), tok('Another line', 10, 1)];
    expect(detectPassportMrz(tokens)).toEqual([]);
  });

  it('accepts the filler "<" as the passport-number check digit (ICAO 9303)', () => {
    // For shorter document numbers, the check digit can be '<' not a digit.
    const fillerCheckLine2 = 'L8988901<<IND8308081M2601011' + '<'.repeat(14) + '02';
    const tokens: OCRToken[] = [tok(MRZ_LINE_1, 10, 0), tok(fillerCheckLine2, 10, 1)];
    expect(detectPassportMrz(tokens)).toHaveLength(1);
  });
});
