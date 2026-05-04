/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { detectAadhaar } from './AadhaarDetector';
import { detectPan } from './PanDetector';
import type { OCRRunner } from './OCRRunner';
import type { OCRToken } from './types';

// Physical rotations tried after 0° fails to yield a text hit. Ordered so
// that 180° is preferred over 90°/270° in tie-breaking — users much more
// often hold a phone upside-down than sideways.
export const PROBE_ROTATIONS = [180, 90, 270] as const;
export type ProbeRotation = (typeof PROBE_ROTATIONS)[number];

export interface RotationProbeOptions<S = HTMLCanvasElement | ImageBitmap> {
  /** Long edge to downscale to for the orientation probe. */
  probeLongEdge?: number;
  /** Override the rotator (used in tests to avoid needing a real canvas). */
  rotate?: (source: S, rotation: 0 | ProbeRotation) => unknown;
  /** Override the downscaler (tests inject an identity). */
  downscale?: (source: S, longEdge: number) => S;
}

// 2400px matches ImagePreprocessor's upright-path long edge. We originally
// tried 1200 to speed up the probe, but on phone photos of small Aadhaar
// cards the extra downscale pushed the card's digits below Tesseract's
// minimum legible size — OCR returned zero hits at every rotation, making
// the probe useless on exactly the samples it was built to rescue.
const DEFAULT_PROBE_LONG_EDGE = 2400;

export interface OrientationCandidate {
  rotation: 0 | ProbeRotation;
  /** Count of Verhoeff-valid Aadhaar + PAN-regex detections on this rotation. */
  textHits: number;
}

/**
 * Score an OCR token set by counting Verhoeff-valid Aadhaar and PAN-regex
 * matches. We deliberately DO NOT use raw OCR confidence — on low-quality
 * phone photos it returns similar confidence for real text and rotated
 * garbage, which is the reason an earlier confidence-based probe was rolled
 * back. Verhoeff validity is a sharp binary signal that doesn't have that
 * failure mode.
 */
export function scoreTokensAsTextHits(tokens: OCRToken[]): number {
  return detectAadhaar(tokens).length + detectPan(tokens).length;
}

/**
 * Draw `source` rotated by `rotation` degrees clockwise into a fresh canvas.
 * Returns a canvas whose dimensions swap on 90/270.
 */
export function rotateCanvas(
  source: HTMLCanvasElement | ImageBitmap,
  rotation: 0 | ProbeRotation
): HTMLCanvasElement {
  const srcW = 'width' in source ? source.width : 0;
  const srcH = 'height' in source ? source.height : 0;
  const out = document.createElement('canvas');
  if (rotation === 90 || rotation === 270) {
    out.width = srcH;
    out.height = srcW;
  } else {
    out.width = srcW;
    out.height = srcH;
  }
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable for rotation');
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(source, -srcW / 2, -srcH / 2);
  return out;
}

/**
 * Downscale `source` so its long edge is at most `longEdge`. Returns the
 * source unchanged if it's already within bounds.
 */
export function downscaleForProbe(
  source: HTMLCanvasElement | ImageBitmap,
  longEdge: number
): HTMLCanvasElement {
  const srcW = 'width' in source ? source.width : 0;
  const srcH = 'height' in source ? source.height : 0;
  const longest = Math.max(srcW, srcH);
  if (longest <= longEdge) {
    if (source instanceof HTMLCanvasElement) return source;
    const pass = document.createElement('canvas');
    pass.width = srcW;
    pass.height = srcH;
    pass.getContext('2d')?.drawImage(source, 0, 0);
    return pass;
  }
  const scale = longEdge / longest;
  const out = document.createElement('canvas');
  out.width = Math.round(srcW * scale);
  out.height = Math.round(srcH * scale);
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable for downscale');
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

/**
 * Probe alternate rotations of a source canvas to find one where OCR yields
 * Verhoeff-valid Aadhaar or PAN hits. Returns the rotation with the highest
 * score, or null if no rotation produces any hits.
 *
 * The caller is expected to have already tried 0° and seen zero text hits;
 * this function exists specifically to answer "is the doc just rotated?".
 */
export async function probeImageRotation<S>(
  source: S,
  ocr: OCRRunner,
  opts: RotationProbeOptions<S> = {}
): Promise<ProbeRotation | null> {
  const longEdge = opts.probeLongEdge ?? DEFAULT_PROBE_LONG_EDGE;
  const downscale =
    opts.downscale ??
    ((s: S, edge: number) =>
      downscaleForProbe(s as unknown as HTMLCanvasElement | ImageBitmap, edge) as unknown as S);
  const rotate =
    opts.rotate ??
    ((s: S, rot: 0 | ProbeRotation) =>
      rotateCanvas(s as unknown as HTMLCanvasElement | ImageBitmap, rot));
  const small = downscale(source, longEdge);

  let best: { rotation: ProbeRotation; hits: number } | null = null;
  for (const rotation of PROBE_ROTATIONS) {
    const rotated = rotate(small, rotation);
    // The OCRRunner interface accepts the same input shapes rotateCanvas
    // returns (HTMLCanvasElement), but in tests the rotator may emit any
    // opaque marker — `recognize` is mocked to ignore the payload and
    // return pre-arranged tokens.
    const tokens = await ocr.recognize(rotated as Parameters<OCRRunner['recognize']>[0]);
    const hits = scoreTokensAsTextHits(tokens);
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { rotation, hits };
    }
  }
  return best?.rotation ?? null;
}
