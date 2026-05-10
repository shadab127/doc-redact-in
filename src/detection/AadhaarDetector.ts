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

// OCR sometimes glues punctuation to a digit group ("5552-", ".8025").
// Strip leading/trailing non-digits so those tokens still match GROUP_RE.
function digitsOnlyIfPureGroup(text: string): string | null {
  const stripped = text.replace(/^\D+/, '').replace(/\D+$/, '');
  return GROUP_RE.test(stripped) ? stripped : null;
}

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
  const ga = digitsOnlyIfPureGroup(a.text);
  const gb = digitsOnlyIfPureGroup(b.text);
  const gc = digitsOnlyIfPureGroup(c.text);
  if (!ga || !gb || !gc) return null;
  const candidate = ga + gb + gc;
  if (!isValidVerhoeff(candidate)) return null;

  const bbox: BoundingBox = unionBbox(unionBbox(a.bbox, b.bbox), c.bbox);
  const maskBbox: BoundingBox = unionBbox(a.bbox, b.bbox);
  const confidence = Math.min(a.confidence, b.confidence, c.confidence);
  return { kind: 'aadhaar', bbox, maskBbox, value: candidate, confidence };
}

// Tesseract sometimes emits a correct digit string inside a bbox that
// doesn't actually fit the glyphs — the bbox extends into surrounding
// whitespace (hallucinated width) or sits on an empty region (hallucinated
// position). Either way, estimateFirstEightSubBox then scales the mask
// across the wrong pixels. Flag such detections `suspicious` so the
// orchestrator can re-run OCR on horizontal bands and replace them with
// a cleanly-bounded same-value detection.
//
// Heuristic: a digit glyph in a typical card font is 0.4-1.3× its line
// height wide. For a 12-char token (no spaces) we expect
// `bbox.w / (12 × bbox.h)` to land in that range. A ratio >1.3 signals
// a hallucinated-wide bbox; <0.4 signals a bbox that's too small to
// contain the characters. Add a small tolerance for matches that include
// spaces in the token text ("8025 0305 5552") by using matchText.length
// instead of 12 when available.
function hasPlausibleGlyphWidth(bbox: BoundingBox, charCount: number): boolean {
  if (bbox.h <= 0 || charCount <= 0) return false;
  const perChar = bbox.w / (charCount * bbox.h);
  return perChar >= 0.4 && perChar <= 1.3;
}

function tryInlineMatches(token: OCRToken): Detection | null {
  const m = [...token.text.matchAll(INLINE_RE)];
  for (const match of m) {
    const candidate = match[1]! + match[2]! + match[3]!;
    if (isValidVerhoeff(candidate)) {
      const d: Detection = {
        kind: 'aadhaar',
        bbox: token.bbox,
        maskBbox: estimateFirstEightSubBox(token.bbox, token.text, match[0]!),
        value: candidate,
        confidence: token.confidence,
      };
      if (!hasPlausibleGlyphWidth(token.bbox, token.text.length)) {
        d.suspicious = true;
      }
      return d;
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

// Dedup by spatial overlap rather than by value: two separate physical
// instances of the same Aadhaar number (e.g. front and back of a combined
// card photo) must both produce masks. We only collapse detections that
// spatially overlap — that covers the case where both the triplet and
// inline paths fire on the same OCR row.
function bboxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.x < b.x + b.w &&
    b.x < a.x + a.w &&
    a.y < b.y + b.h &&
    b.y < a.y + a.h
  );
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
    if (!d) continue;
    const duplicate = out.some(
      (e) => e.value === d.value && bboxesOverlap(e.bbox, d.bbox)
    );
    if (!duplicate) out.push(d);
  }

  return out;
}
