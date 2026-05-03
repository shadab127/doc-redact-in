/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import type { BoundingBox, Detection, DetectionKind } from '@/src/detection/types';

// Faces are masked with a solid black rectangle (same treatment as other PII),
// not a blur. A blur is reversible in principle — known-σ deblurring and face
// super-resolution can recover usable features from σ=30 Gaussian. A solid
// fill is information-theoretically irreversible: the masked pixels contain
// zero face data. See RFC §5.1 for the full rationale.
const SOLID_KINDS: ReadonlySet<DetectionKind> = new Set<DetectionKind>([
  'aadhaar',
  'pan',
  'passport_mrz',
  'uidai_qr',
  'face',
]);

export interface MaskRenderStyle {
  solidColor: string;
  facePaddingFraction: number;
  qrPaddingPx: number;
}

export const DEFAULT_STYLE: MaskRenderStyle = {
  solidColor: '#000000',
  facePaddingFraction: 0.15,
  qrPaddingPx: 5,
};

function padBbox(b: BoundingBox, px: number, maxW: number, maxH: number): BoundingBox {
  const x = Math.max(0, b.x - px);
  const y = Math.max(0, b.y - px);
  const right = Math.min(maxW, b.x + b.w + px);
  const bottom = Math.min(maxH, b.y + b.h + px);
  return { x, y, w: right - x, h: bottom - y };
}

function expandFraction(b: BoundingBox, frac: number, maxW: number, maxH: number): BoundingBox {
  const dx = b.w * frac;
  const dy = b.h * frac;
  const x = Math.max(0, b.x - dx);
  const y = Math.max(0, b.y - dy);
  const right = Math.min(maxW, b.x + b.w + dx);
  const bottom = Math.min(maxH, b.y + b.h + dy);
  return { x, y, w: right - x, h: bottom - y };
}

export interface RenderableCanvas {
  width: number;
  height: number;
  getContext(contextId: '2d'): CanvasRenderingContext2D | null;
}

export interface RenderMasksOpts {
  style?: MaskRenderStyle;
}

export function renderMasks(
  canvas: RenderableCanvas,
  detections: readonly Detection[],
  opts: RenderMasksOpts = {}
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  const style = opts.style ?? DEFAULT_STYLE;

  for (const d of detections) {
    if (!SOLID_KINDS.has(d.kind)) continue;
    const padded = paddedBbox(d, style, canvas.width, canvas.height);
    ctx.fillStyle = style.solidColor;
    ctx.fillRect(padded.x, padded.y, padded.w, padded.h);
  }
  // 'other_qr' is surfaced but never auto-masked (RFC §4.7).
}

function paddedBbox(
  d: Detection,
  style: MaskRenderStyle,
  maxW: number,
  maxH: number
): BoundingBox {
  if (d.kind === 'uidai_qr') {
    return padBbox(d.maskBbox, style.qrPaddingPx, maxW, maxH);
  }
  // Face detector bbox tightly tracks the detected face; expand slightly to
  // catch hair, chin, and ears that the model sometimes excludes.
  if (d.kind === 'face') {
    return expandFraction(d.maskBbox, style.facePaddingFraction, maxW, maxH);
  }
  return d.maskBbox;
}

export const _internal = { padBbox, expandFraction, SOLID_KINDS };
