/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';
import { detectPan } from '@/src/detection/PanDetector';
import type { OCRToken } from '@/src/detection/types';

function tok(text: string): OCRToken {
  return {
    text,
    bbox: { x: 0, y: 0, w: 100, h: 20 },
    confidence: 0.9,
    lineId: 0,
  };
}

describe('detectPan', () => {
  it('accepts a PAN with a valid entity-type code in the 4th position', () => {
    const result = detectPan([tok('ABCPE1234F')]);
    expect(result).toHaveLength(1);
    expect(result[0]!.value).toBe('ABCPE1234F');
    expect(result[0]!.kind).toBe('pan');
    expect(result[0]!.maskBbox).toEqual(result[0]!.bbox);
  });

  it.each(['P', 'F', 'C', 'H', 'A', 'T', 'B', 'L', 'J', 'G'])(
    'accepts entity code %s',
    (code) => {
      const pan = `AAA${code}E1234Z`;
      expect(detectPan([tok(pan)])).toHaveLength(1);
    }
  );

  it('rejects PAN with invalid 4th-char entity code', () => {
    expect(detectPan([tok('ABCZE1234F')])).toEqual([]);
    expect(detectPan([tok('ABCXE1234F')])).toEqual([]);
  });

  it('rejects lowercase PAN', () => {
    expect(detectPan([tok('abcpe1234f')])).toEqual([]);
  });

  it('rejects wrong length', () => {
    expect(detectPan([tok('ABCPE1234')])).toEqual([]);
    expect(detectPan([tok('ABCPE1234FX')])).toEqual([]);
  });

  it('rejects PAN-like with digits in letter slots', () => {
    expect(detectPan([tok('AB1PE1234F')])).toEqual([]);
  });
});
