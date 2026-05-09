/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 *
 * Mask-without-decode QR locator. When zxing and jsQR both fail, attempt
 * to visually locate a QR-shaped region (textured, ~square, not covered by
 * OCR text, not covered by a detected face) and emit a low-confidence
 * `other_qr` detection. The user sees it in the toggle list and can opt
 * out; our product goal is masking, not decoding, so a plausible visual
 * match is still useful.
 *
 * Per `feedback_verify_detector_output.md` / `feedback_detector_filter_requires_real_fp.md`:
 *   - Fires ONLY when zxing returns 0 QR detections. No override.
 *   - Rejects candidate boxes that overlap a face or sit on text tokens.
 *   - Low confidence (0.4) so it's visually distinct in the preview.
 */
import type { BoundingBox, Detection, OCRToken } from './types';

export interface QrVisualLocatorInput {
  canvas: HTMLCanvasElement | ImageBitmap;
  tokens: readonly OCRToken[];
  faces: readonly Detection[];
}

export interface QrVisualLocatorOptions {
  /** Long-edge cell count for the scoring grid. */
  gridDim?: number;
  /**
   * Minimum grayscale stdev required in a "textured" cell. Calibrated at
   * 40/255 empirically against Aadhaar sample grids: card backgrounds
   * (solid colour) score ~15, printed text ~35, QR modules ~55.
   */
  textureThreshold?: number;
  /**
   * Minimum black/white bimodality in a cell (fraction of pixels within
   * 32 of 0 OR 255). QRs score ≥ 0.55; photo regions score < 0.3.
   */
  bimodalityThreshold?: number;
  /** Minimum allowed candidate aspect (w/h). 0.75 → very near square. */
  minAspect?: number;
  /** Maximum allowed candidate aspect. */
  maxAspect?: number;
  /** Candidate area as fraction of canvas area (min/max). */
  minAreaFrac?: number;
  maxAreaFrac?: number;
  /** Confidence assigned to a surviving detection. */
  confidence?: number;
}

const DEFAULTS: Required<QrVisualLocatorOptions> = {
  gridDim: 24,
  textureThreshold: 40,
  bimodalityThreshold: 0.55,
  minAspect: 0.75,
  maxAspect: 1.33,
  minAreaFrac: 0.005,
  maxAreaFrac: 0.25,
  confidence: 0.4,
};

function canvasToImageData(
  src: HTMLCanvasElement | ImageBitmap
): ImageData | null {
  if (typeof document === 'undefined') return null;
  const w = src.width;
  const h = src.height;
  if (!w || !h) return null;
  let ctx: CanvasRenderingContext2D | null;
  let canvas: HTMLCanvasElement;
  const hasGetContext = typeof (src as HTMLCanvasElement).getContext === 'function';
  if (hasGetContext) {
    canvas = src as HTMLCanvasElement;
    ctx = canvas.getContext('2d');
  } else {
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    ctx = canvas.getContext('2d');
    if (ctx) ctx.drawImage(src as ImageBitmap, 0, 0);
  }
  if (!ctx) return null;
  try {
    return ctx.getImageData(0, 0, w, h);
  } catch {
    return null;
  }
}

function iou(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (inter === 0) return 0;
  const union = a.w * a.h + b.w * b.h - inter;
  return inter / union;
}

function overlapFraction(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return a.w * a.h > 0 ? inter / (a.w * a.h) : 0;
}

interface CellScore {
  r: number;
  c: number;
  textured: boolean;
  bimodal: boolean;
  ocrHit: boolean;
}

export function locateQrVisually(
  input: QrVisualLocatorInput,
  opts: QrVisualLocatorOptions = {}
): Detection[] {
  const cfg = { ...DEFAULTS, ...opts };
  const imageData = canvasToImageData(input.canvas);
  if (!imageData) return [];

  const W = imageData.width;
  const H = imageData.height;
  const longEdge = Math.max(W, H);
  if (longEdge === 0) return [];

  // Grid dimensions — keep cells roughly square even on portrait/landscape.
  const cellSize = Math.max(8, Math.floor(longEdge / cfg.gridDim));
  const cols = Math.max(1, Math.floor(W / cellSize));
  const rows = Math.max(1, Math.floor(H / cellSize));
  if (cols < 2 || rows < 2) return [];

  // Pre-bucket OCR tokens into cells (coverage map)
  const tokenCells = new Uint8Array(rows * cols);
  for (const tok of input.tokens) {
    const cx0 = Math.floor(tok.bbox.x / cellSize);
    const cy0 = Math.floor(tok.bbox.y / cellSize);
    const cx1 = Math.min(cols - 1, Math.floor((tok.bbox.x + tok.bbox.w) / cellSize));
    const cy1 = Math.min(rows - 1, Math.floor((tok.bbox.y + tok.bbox.h) / cellSize));
    for (let r = cy0; r <= cy1 && r < rows; r++) {
      for (let c = cx0; c <= cx1 && c < cols; c++) {
        if (r >= 0 && c >= 0) tokenCells[r * cols + c] = 1;
      }
    }
  }

  // Score each cell: texture (stdev of luminance) + bimodality (black+white frac)
  const data = imageData.data;
  const cellStride = 4 * W;
  const scored: CellScore[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ r: 0, c: 0, textured: false, bimodal: false, ocrHit: false }))
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c * cellSize;
      const y0 = r * cellSize;
      const x1 = Math.min(W, x0 + cellSize);
      const y1 = Math.min(H, y0 + cellSize);
      let sum = 0;
      let sumSq = 0;
      let n = 0;
      let dark = 0;
      let light = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = y * cellStride + x * 4;
          const r0 = data[i]!;
          const g0 = data[i + 1]!;
          const b0 = data[i + 2]!;
          const lum = Math.round(0.299 * r0 + 0.587 * g0 + 0.114 * b0);
          sum += lum;
          sumSq += lum * lum;
          n++;
          if (lum <= 32) dark++;
          else if (lum >= 223) light++;
        }
      }
      if (n === 0) continue;
      const mean = sum / n;
      const variance = sumSq / n - mean * mean;
      const stdev = Math.sqrt(Math.max(0, variance));
      const bimodality = (dark + light) / n;

      const cell = scored[r]![c]!;
      cell.r = r;
      cell.c = c;
      cell.textured = stdev >= cfg.textureThreshold;
      cell.bimodal = bimodality >= cfg.bimodalityThreshold;
      cell.ocrHit = tokenCells[r * cols + c] === 1;
    }
  }

  // Candidate cells: textured OR bimodal, AND not on OCR text
  const isCandidate = (cell: CellScore) =>
    (cell.textured || cell.bimodal) && !cell.ocrHit;

  // Connected-components via flood-fill (4-neighbour)
  const visited = new Uint8Array(rows * cols);
  const components: { rMin: number; rMax: number; cMin: number; cMax: number; count: number; bimodal: number }[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (visited[idx]) continue;
      const cell = scored[r]![c]!;
      if (!isCandidate(cell)) {
        visited[idx] = 1;
        continue;
      }
      let rMin = r, rMax = r, cMin = c, cMax = c, count = 0, bimodal = 0;
      const queue: Array<[number, number]> = [[r, c]];
      visited[idx] = 1;
      while (queue.length > 0) {
        const [y, x] = queue.shift()!;
        count++;
        if (scored[y]![x]!.bimodal) bimodal++;
        rMin = Math.min(rMin, y);
        rMax = Math.max(rMax, y);
        cMin = Math.min(cMin, x);
        cMax = Math.max(cMax, x);
        const neighbours: Array<[number, number]> = [
          [y - 1, x],
          [y + 1, x],
          [y, x - 1],
          [y, x + 1],
        ];
        for (const [ny, nx] of neighbours) {
          if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) continue;
          const nidx = ny * cols + nx;
          if (visited[nidx]) continue;
          visited[nidx] = 1;
          if (isCandidate(scored[ny]![nx]!)) queue.push([ny, nx]);
        }
      }
      components.push({ rMin, rMax, cMin, cMax, count, bimodal });
    }
  }

  // Filter components by shape + size
  const canvasArea = W * H;
  const candidates: Detection[] = [];
  for (const comp of components) {
    const boxX = comp.cMin * cellSize;
    const boxY = comp.rMin * cellSize;
    const boxW = (comp.cMax - comp.cMin + 1) * cellSize;
    const boxH = (comp.rMax - comp.rMin + 1) * cellSize;
    const aspect = boxW / boxH;
    const areaFrac = (boxW * boxH) / canvasArea;
    if (aspect < cfg.minAspect || aspect > cfg.maxAspect) continue;
    if (areaFrac < cfg.minAreaFrac || areaFrac > cfg.maxAreaFrac) continue;
    // Require bimodality dominance across the component — QRs have >60% of
    // their cells in the bimodal region; photos/logos don't.
    if (comp.count === 0 || comp.bimodal / comp.count < 0.6) continue;

    const bbox: BoundingBox = {
      x: boxX,
      y: boxY,
      w: Math.min(boxW, W - boxX),
      h: Math.min(boxH, H - boxY),
    };
    // Reject if the candidate substantially overlaps any detected face —
    // photos (printed ID face) can be textured + bimodal in strong light.
    const overlapsFace = input.faces.some((f) => overlapFraction(bbox, f.bbox) > 0.4);
    if (overlapsFace) continue;

    candidates.push({
      kind: 'other_qr',
      bbox,
      maskBbox: bbox,
      value: 'visual-qr-candidate',
      confidence: cfg.confidence,
    });
  }

  // Dedupe overlapping candidates
  const merged: Detection[] = [];
  for (const det of candidates) {
    if (merged.some((m) => iou(m.bbox, det.bbox) > 0.3)) continue;
    merged.push(det);
  }
  return merged;
}
