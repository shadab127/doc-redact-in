/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import type { BoundingBox, Detection, DetectionKind } from '@/src/detection/types';

export const FACE_BLUR_SIGMA_PX = 30;

const SOLID_KINDS: ReadonlySet<DetectionKind> = new Set<DetectionKind>([
  'aadhaar',
  'pan',
  'passport_mrz',
  'uidai_qr',
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

  // Face blurs run first so the blur samples original pixels, not pixels
  // already covered by solid masks that happen to abut the face.
  for (const d of detections) {
    if (d.kind === 'face') drawFaceBlur(ctx, canvas, d.maskBbox, style);
  }

  for (const d of detections) {
    if (!SOLID_KINDS.has(d.kind)) continue;
    const padded =
      d.kind === 'uidai_qr'
        ? padBbox(d.maskBbox, style.qrPaddingPx, canvas.width, canvas.height)
        : d.maskBbox;
    ctx.fillStyle = style.solidColor;
    ctx.fillRect(padded.x, padded.y, padded.w, padded.h);
  }
  // 'other_qr' is surfaced but never auto-masked (RFC §4.7).
}

function drawFaceBlur(
  ctx: CanvasRenderingContext2D,
  canvas: RenderableCanvas,
  bbox: BoundingBox,
  style: MaskRenderStyle
): void {
  const expanded = expandFraction(bbox, style.facePaddingFraction, canvas.width, canvas.height);
  const prevFilter = ctx.filter;
  ctx.save();
  ctx.beginPath();
  ctx.rect(expanded.x, expanded.y, expanded.w, expanded.h);
  ctx.clip();
  ctx.filter = `blur(${FACE_BLUR_SIGMA_PX}px)`;
  ctx.drawImage(
    canvas as unknown as CanvasImageSource,
    expanded.x,
    expanded.y,
    expanded.w,
    expanded.h,
    expanded.x,
    expanded.y,
    expanded.w,
    expanded.h
  );
  ctx.restore();
  ctx.filter = prevFilter;
}

export const _internal = { padBbox, expandFraction, SOLID_KINDS };
