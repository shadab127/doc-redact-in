/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import type { Detection, OCRToken } from './types';

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const ENTITY_CODES = new Set(['P', 'F', 'C', 'H', 'A', 'T', 'B', 'L', 'J', 'G']);

export function detectPan(tokens: OCRToken[]): Detection[] {
  const out: Detection[] = [];
  for (const t of tokens) {
    const text = t.text.trim();
    if (!PAN_RE.test(text)) continue;
    if (!ENTITY_CODES.has(text[3]!)) continue;
    out.push({
      kind: 'pan',
      bbox: t.bbox,
      maskBbox: t.bbox,
      value: text,
      confidence: t.confidence,
    });
  }
  return out;
}
