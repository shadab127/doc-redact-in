/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OCRToken {
  text: string;
  bbox: BoundingBox;
  confidence: number;
  lineId: number;
}

export type DetectionKind =
  | 'aadhaar'
  | 'pan'
  | 'passport_mrz'
  | 'face'
  | 'uidai_qr'
  | 'other_qr';

export interface Detection {
  kind: DetectionKind;
  bbox: BoundingBox;
  maskBbox: BoundingBox;
  value: string;
  confidence: number;
  /**
   * Inline-match Aadhaar detections flag themselves as suspicious when
   * their bbox aspect ratio doesn't match a normal 12-digit row — this
   * happens when Tesseract emits the right text but a hallucinated wide
   * bbox covering whitespace beyond the glyphs. The orchestrator reads
   * this flag to decide whether to re-run detection on horizontal bands
   * even when a hit already exists.
   */
  suspicious?: boolean;
}

export interface DetectionResult {
  detections: Detection[];
  sourceWidth: number;
  sourceHeight: number;
  elapsedMs: number;
}

export interface PageDetectionResult extends DetectionResult {
  pageIndex: number;
}

export interface DocumentDetectionResult {
  pages: PageDetectionResult[];
  totalElapsedMs: number;
  sourceKind: 'image' | 'pdf';
  pageSizesPt?: readonly { width: number; height: number }[];
}

export function unionBbox(a: BoundingBox, b: BoundingBox): BoundingBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.w, b.x + b.w);
  const bottom = Math.max(a.y + a.h, b.y + b.h);
  return { x, y, w: right - x, h: bottom - y };
}
