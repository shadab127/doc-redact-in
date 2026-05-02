/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import type { Detection, OCRToken } from './types';
import { unionBbox } from './types';

// Indian passport MRZ, ICAO 9303-compliant, 2 lines x 44 chars, OCR-B font.
// Line 1: P<IND<NAME_FIELDS padded with '<'                          (44 chars)
// Line 2: [A-Z0-9<]{9}[0-9]IND\d{6}\d[MF<]\d{6}\d[A-Z0-9<]{14}\d\d  (44 chars)
const LINE1 = /^P<IND[A-Z<]{39}$/;
// Passport-number field is 9 chars followed by a check digit at position 10.
// The check digit is normally numeric, but ICAO 9303 allows '<' (filler) when
// the document number is shorter than 9 chars — accept either.
const LINE2 = /^[A-Z0-9<]{9}[0-9<]IND\d{6}\d[MF<]\d{6}\d[A-Z0-9<]{14}\d\d$/;

function sanitize(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9<]/g, '');
}

function tokensByLine(tokens: OCRToken[]): Map<number, OCRToken[]> {
  const by = new Map<number, OCRToken[]>();
  for (const t of tokens) {
    const bucket = by.get(t.lineId);
    if (bucket) bucket.push(t);
    else by.set(t.lineId, [t]);
  }
  for (const line of by.values()) line.sort((a, b) => a.bbox.x - b.bbox.x);
  return by;
}

function lineString(tokens: OCRToken[]): string {
  return tokens.map((t) => sanitize(t.text)).join('');
}

function lineBbox(tokens: OCRToken[]): Detection['bbox'] {
  return tokens.reduce<Detection['bbox']>(
    (acc, t, i) => (i === 0 ? t.bbox : unionBbox(acc, t.bbox)),
    tokens[0]!.bbox
  );
}

function minConfidence(tokens: OCRToken[]): number {
  return tokens.reduce((m, t) => Math.min(m, t.confidence), 1);
}

export function detectPassportMrz(tokens: OCRToken[]): Detection[] {
  const byLine = tokensByLine(tokens);
  const lines = [...byLine.entries()].sort((a, b) => a[0] - b[0]);
  const out: Detection[] = [];

  for (let i = 0; i + 1 < lines.length; i++) {
    const lineA = lines[i]![1];
    const lineB = lines[i + 1]![1];
    const strA = lineString(lineA);
    const strB = lineString(lineB);
    if (!LINE1.test(strA) || !LINE2.test(strB)) continue;

    const bbox = unionBbox(lineBbox(lineA), lineBbox(lineB));
    out.push({
      kind: 'passport_mrz',
      bbox,
      maskBbox: bbox,
      value: `${strA}\n${strB}`,
      confidence: Math.min(minConfidence(lineA), minConfidence(lineB)),
    });
  }
  return out;
}
