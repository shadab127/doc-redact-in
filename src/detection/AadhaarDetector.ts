/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { isValidVerhoeff } from './Verhoeff';
import type { BoundingBox, Detection, OCRToken } from './types';
import { unionBbox } from './types';

const GROUP_RE = /^\d{4}$/;
const INLINE_RE = /\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b/g;

function tokensByLine(tokens: OCRToken[]): Map<number, OCRToken[]> {
  const by = new Map<number, OCRToken[]>();
  for (const t of tokens) {
    const bucket = by.get(t.lineId);
    if (bucket) bucket.push(t);
    else by.set(t.lineId, [t]);
  }
  for (const line of by.values()) {
    line.sort((a, b) => a.bbox.x - b.bbox.x);
  }
  return by;
}

function tryTripletStartingAt(line: OCRToken[], idx: number): Detection | null {
  const a = line[idx];
  const b = line[idx + 1];
  const c = line[idx + 2];
  if (!a || !b || !c) return null;
  if (!GROUP_RE.test(a.text) || !GROUP_RE.test(b.text) || !GROUP_RE.test(c.text)) {
    return null;
  }
  const candidate = a.text + b.text + c.text;
  if (!isValidVerhoeff(candidate)) return null;

  const bbox: BoundingBox = unionBbox(unionBbox(a.bbox, b.bbox), c.bbox);
  const maskBbox: BoundingBox = unionBbox(a.bbox, b.bbox);
  const confidence = Math.min(a.confidence, b.confidence, c.confidence);
  return { kind: 'aadhaar', bbox, maskBbox, value: candidate, confidence };
}

function tryInlineMatches(token: OCRToken): Detection | null {
  const m = [...token.text.matchAll(INLINE_RE)];
  for (const match of m) {
    const candidate = match[1]! + match[2]! + match[3]!;
    if (isValidVerhoeff(candidate)) {
      return {
        kind: 'aadhaar',
        bbox: token.bbox,
        maskBbox: estimateFirstEightSubBox(token.bbox, token.text, match[0]!),
        value: candidate,
        confidence: token.confidence,
      };
    }
  }
  return null;
}

function firstEightCharLength(matchText: string): number {
  let digits = 0;
  for (let i = 0; i < matchText.length; i++) {
    const c = matchText.charCodeAt(i);
    if (c >= 48 && c <= 57) digits++;
    if (digits === 8) return i + 1;
  }
  return matchText.length;
}

function estimateFirstEightSubBox(
  bbox: BoundingBox,
  fullText: string,
  matchText: string
): BoundingBox {
  const matchStart = fullText.indexOf(matchText);
  if (matchStart < 0 || fullText.length === 0) return bbox;
  const firstEightLen = firstEightCharLength(matchText);
  const startFrac = matchStart / fullText.length;
  const endFrac = (matchStart + firstEightLen) / fullText.length;
  return {
    x: bbox.x + bbox.w * startFrac,
    y: bbox.y,
    w: bbox.w * (endFrac - startFrac),
    h: bbox.h,
  };
}

export function detectAadhaar(tokens: OCRToken[]): Detection[] {
  const out: Detection[] = [];

  for (const line of tokensByLine(tokens).values()) {
    for (let i = 0; i + 2 < line.length; i++) {
      const d = tryTripletStartingAt(line, i);
      if (d) out.push(d);
    }
  }

  for (const t of tokens) {
    const d = tryInlineMatches(t);
    if (d && !out.some((e) => e.value === d.value)) out.push(d);
  }

  return out;
}
