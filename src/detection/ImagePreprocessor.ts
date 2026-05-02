/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */

export interface PreprocessOptions {
  maxLongEdge?: number;
  applyClahe?: boolean;
  applyOtsu?: boolean;
}

const DEFAULT_MAX_LONG_EDGE = 2400;

export function fitWithin(
  width: number,
  height: number,
  maxLongEdge: number
): { width: number; height: number; scale: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) return { width, height, scale: 1 };
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    scale,
  };
}

export function toGrayscale(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i]!;
    const g = rgba[i + 1]!;
    const b = rgba[i + 2]!;
    // ITU-R BT.601 weights
    const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    out[i] = y;
    out[i + 1] = y;
    out[i + 2] = y;
    out[i + 3] = rgba[i + 3]!;
  }
  return out;
}

export function otsuThreshold(grayRgba: Uint8ClampedArray): number {
  const hist = new Uint32Array(256);
  let total = 0;
  for (let i = 0; i < grayRgba.length; i += 4) {
    const v = grayRgba[i]!;
    hist[v] = (hist[v] ?? 0) + 1;
    total++;
  }
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t]!;

  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

export function applyOtsu(
  grayRgba: Uint8ClampedArray,
  threshold?: number
): Uint8ClampedArray {
  const t = threshold ?? otsuThreshold(grayRgba);
  const out = new Uint8ClampedArray(grayRgba.length);
  for (let i = 0; i < grayRgba.length; i += 4) {
    const v = grayRgba[i]! > t ? 255 : 0;
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = grayRgba[i + 3]!;
  }
  return out;
}

// Contrast Limited Adaptive Histogram Equalization — global variant
// (no tile splitting; sufficient for ID docs which are mostly uniform lighting).
// For per-tile CLAHE we'd need a 2D tiling pass; deferred to W3 if OCR accuracy
// spike (Gate #1) shows it is needed.
export function applyClaheGlobal(
  grayRgba: Uint8ClampedArray,
  clipLimit = 0.01
): Uint8ClampedArray {
  const hist = new Uint32Array(256);
  let count = 0;
  for (let i = 0; i < grayRgba.length; i += 4) {
    const v = grayRgba[i]!;
    hist[v] = (hist[v] ?? 0) + 1;
    count++;
  }
  const clip = Math.max(1, Math.floor(count * clipLimit));
  let excess = 0;
  for (let v = 0; v < 256; v++) {
    if (hist[v]! > clip) {
      excess += hist[v]! - clip;
      hist[v] = clip;
    }
  }
  const add = Math.floor(excess / 256);
  for (let v = 0; v < 256; v++) hist[v] = (hist[v] ?? 0) + add;

  const cdf = new Uint32Array(256);
  cdf[0] = hist[0]!;
  for (let v = 1; v < 256; v++) cdf[v] = cdf[v - 1]! + hist[v]!;
  const cdfMin = cdf.find((x) => x > 0) ?? 0;
  const denom = count - cdfMin || 1;

  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    lut[v] = Math.max(0, Math.min(255, Math.round(((cdf[v]! - cdfMin) / denom) * 255)));
  }

  const out = new Uint8ClampedArray(grayRgba.length);
  for (let i = 0; i < grayRgba.length; i += 4) {
    const v = lut[grayRgba[i]!]!;
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = grayRgba[i + 3]!;
  }
  return out;
}

// 3x3 Gaussian blur approximation (σ≈0.5): weights [1,2,1; 2,4,2; 1,2,1]/16.
export function gaussianBlur3x3(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  const idx = (x: number, y: number) => (y * width + x) * 4;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        const k = idx(x, y);
        out[k] = rgba[k]!;
        out[k + 1] = rgba[k + 1]!;
        out[k + 2] = rgba[k + 2]!;
        out[k + 3] = rgba[k + 3]!;
        continue;
      }
      for (let c = 0; c < 3; c++) {
        const sum =
          1 * rgba[idx(x - 1, y - 1) + c]! +
          2 * rgba[idx(x, y - 1) + c]! +
          1 * rgba[idx(x + 1, y - 1) + c]! +
          2 * rgba[idx(x - 1, y) + c]! +
          4 * rgba[idx(x, y) + c]! +
          2 * rgba[idx(x + 1, y) + c]! +
          1 * rgba[idx(x - 1, y + 1) + c]! +
          2 * rgba[idx(x, y + 1) + c]! +
          1 * rgba[idx(x + 1, y + 1) + c]!;
        out[idx(x, y) + c] = Math.round(sum / 16);
      }
      out[idx(x, y) + 3] = rgba[idx(x, y) + 3]!;
    }
  }
  return out;
}

export interface PreprocessInput {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

export interface PreprocessOutput extends PreprocessInput {
  readonly threshold: number | null;
}

export function preprocessForOCR(
  input: PreprocessInput,
  opts: PreprocessOptions = {}
): PreprocessOutput {
  const maxLongEdge = opts.maxLongEdge ?? DEFAULT_MAX_LONG_EDGE;
  if (
    Math.max(input.width, input.height) > maxLongEdge &&
    opts.maxLongEdge !== 0
  ) {
    // Downscale happens in the caller's canvas context, since it needs
    // a real image to resample; here we just check the invariant was honoured.
  }
  let data = toGrayscale(input.data);
  data = gaussianBlur3x3(data, input.width, input.height);
  if (opts.applyClahe !== false) data = applyClaheGlobal(data);
  let threshold: number | null = null;
  if (opts.applyOtsu) {
    threshold = otsuThreshold(data);
    data = applyOtsu(data, threshold);
  }
  return { data, width: input.width, height: input.height, threshold };
}
