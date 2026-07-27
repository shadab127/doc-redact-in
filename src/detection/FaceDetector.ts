/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import type { BoundingBox, Detection } from './types';

export interface FaceDetectorRunner {
  detect(canvas: HTMLCanvasElement | ImageBitmap): Promise<Detection[]>;
}

export interface FaceDetectorOptions {
  /**
   * Base path for MediaPipe vision WASM assets (vision_wasm_internal.js/.wasm,
   * vision_wasm_nosimd_internal.js/.wasm). Loaded from our own origin so the
   * strict CSP's connect-src 'self' is satisfied.
   */
  wasmBasePath?: string;
  /**
   * Override the set of BlazeFace models to load. Defaults to the union of
   * short-range + full-range — see comment on DEFAULT_OPTS for reasoning.
   */
  modelAssetPaths?: readonly string[];
  /** Score threshold below which detections are dropped. */
  minConfidence?: number;
  /**
   * IoU threshold above which detections from different models are treated
   * as the same face (deduplicated). 0.3 matches RFC §4.8 RegionMerger.
   */
  mergeIoU?: number;
}

// MediaPipe-native shapes (subset we use). Keeping these local avoids having
// to plumb the full `@mediapipe/tasks-vision` type graph through our code;
// we only care about the bounding box + category score.
interface MpBoundingBox {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

interface MpCategory {
  score: number;
}

interface MpDetection {
  boundingBox?: MpBoundingBox;
  categories: MpCategory[];
}

interface MpDetectionResult {
  detections: MpDetection[];
}

interface MpWasmFileset {
  // Opaque to us.
  readonly __mediaPipeWasmFileset?: never;
}

interface MpFaceDetectorStatic {
  createFromOptions(
    wasmFileset: MpWasmFileset,
    opts: {
      baseOptions: { modelAssetPath: string };
      runningMode: 'IMAGE' | 'VIDEO';
      minDetectionConfidence?: number;
    }
  ): Promise<MpFaceDetector>;
}

interface MpFaceDetector {
  detect(image: HTMLCanvasElement | ImageBitmap | HTMLImageElement): MpDetectionResult;
}

interface MpFilesetResolver {
  forVisionTasks(basePath: string): Promise<MpWasmFileset>;
}

interface MpModule {
  FaceDetector: MpFaceDetectorStatic;
  FilesetResolver: MpFilesetResolver;
}

async function loadMediaPipe(): Promise<MpModule> {
  return (await import('@mediapipe/tasks-vision')) as unknown as MpModule;
}

const DEFAULT_OPTS: Required<FaceDetectorOptions> = {
  wasmBasePath: '/vendor/mediapipe',
  // Run both BlazeFace variants in parallel and merge their results by IoU.
  // Short-range is tuned for selfies (face fills frame); full-range targets
  // back-camera scenes with smaller faces. On our 13-sample set short-range
  // alone gave 5 face hits and full-range alone gave 10 — but not the same
  // 5; each caught one sample the other missed. Running both recovers the
  // union (measured 11/13) at the cost of one extra ~1 MB model download
  // and one extra inference pass per image. The bundle hit is acceptable
  // because the face detector is lazy-loaded on first file drop.
  modelAssetPaths: [
    '/vendor/mediapipe/blaze_face_short_range.tflite',
    '/vendor/mediapipe/blaze_face_full_range.tflite',
  ],
  // Holding at BlazeFace's default 0.5. We trialled 0.3 to catch more small
  // Aadhaar-card face photos; that improved recall on plain phone photos but
  // generated confident false positives on text patterns inside UIDAI
  // e-Aadhaar PDFs (blocks of text scored as faces). For a privacy tool,
  // a detection the user sees and trusts that isn't a real face is worse
  // than no detection at all — it produces false confidence.
  minConfidence: 0.5,
  mergeIoU: 0.3,
};

function iou(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (intersection === 0) return 0;
  const union = a.w * a.h + b.w * b.h - intersection;
  return intersection / union;
}

/**
 * Compute the fraction of `face`'s area that is covered by the union of
 * the supplied axis-aligned rectangles (`textBoxes`).
 *
 * We scan at 1-pixel granularity along the x-axis using a sweep-line over
 * the text boxes clipped to the face rectangle, then accumulate covered
 * columns. This avoids double-counting overlapping text boxes without
 * needing a full polygon-union implementation.
 *
 * Exported for unit testing only — callers should use
 * `rejectFacesCoveredByOCR`.
 */
export function ocrCoverageRatio(face: BoundingBox, textBoxes: readonly BoundingBox[]): number {
  const faceArea = face.w * face.h;
  if (faceArea <= 0 || textBoxes.length === 0) return 0;

  // Clip each text box to the face bbox and compute covered area via a
  // column sweep (integer x positions). We build a sorted list of
  // [colStart, colEnd) intervals clipped to [face.x, face.x + face.w),
  // merge overlapping intervals, and sum their widths × covered row span.
  //
  // To keep this O(n log n) and not O(w × h), we do a 2D sweep:
  //   for each column x in [face.x, face.x + face.w):
  //     covered_height(x) = length of union of [row intervals from text boxes that contain x]
  //   coveredArea = Σ covered_height(x)
  //
  // With real Aadhaar images at ~1000×600 px the face box is ~120×150 px,
  // so the inner sweep is at most 120 iterations of n≤~50 intervals — fast.

  const fx = face.x;
  const fy = face.y;
  const fr = face.x + face.w;
  const fb = face.y + face.h;

  // Precompute clipped boxes once
  const clipped: Array<{ x1: number; x2: number; y1: number; y2: number }> = [];
  for (const t of textBoxes) {
    const cx1 = Math.max(fx, t.x);
    const cx2 = Math.min(fr, t.x + t.w);
    const cy1 = Math.max(fy, t.y);
    const cy2 = Math.min(fb, t.y + t.h);
    if (cx2 > cx1 && cy2 > cy1) {
      clipped.push({ x1: cx1, x2: cx2, y1: cy1, y2: cy2 });
    }
  }
  if (clipped.length === 0) return 0;

  let coveredArea = 0;
  for (let x = fx; x < fr; x++) {
    // Collect y-intervals from all clipped boxes that span column x
    const intervals: Array<[number, number]> = [];
    for (const c of clipped) {
      if (x >= c.x1 && x < c.x2) {
        intervals.push([c.y1, c.y2]);
      }
    }
    if (intervals.length === 0) continue;
    // Merge y-intervals and sum their length
    intervals.sort((a, b) => a[0] - b[0]);
    let mergedStart = intervals[0]![0];
    let mergedEnd = intervals[0]![1];
    for (let i = 1; i < intervals.length; i++) {
      const [s, e] = intervals[i]!;
      if (s < mergedEnd) {
        mergedEnd = Math.max(mergedEnd, e);
      } else {
        coveredArea += mergedEnd - mergedStart;
        mergedStart = s;
        mergedEnd = e;
      }
    }
    coveredArea += mergedEnd - mergedStart;
  }

  return coveredArea / faceArea;
}

/**
 * Post-filter that drops face detections whose bounding box is substantially
 * covered by OCR-token bounding boxes (i.e. the "face" is sitting on top of a
 * text block and is therefore a false positive).
 *
 * Rule: reject face F when
 *   (area of F covered by union of OCR token bboxes) / area(F) >= coverageThreshold
 *
 * Default threshold 0.5 means "50 % or more of the face box is text → reject".
 * This was chosen per RFC §4.8: the known FP scenario (text blocks in
 * e-Aadhaar PDFs scoring as faces at minConfidence 0.3) would have near-100 %
 * OCR coverage, while a genuine face photo on a printed card should have
 * near-0 % OCR coverage. The 0.5 threshold sits between those two extremes.
 *
 * CONTRACT:
 *   - Input `faces` must already be merged (short+full-range dedup). This
 *     function runs AFTER `mergeFaceDetections`, not instead of it.
 *   - `ocrTokens` is the raw Tesseract token list for the same canvas.
 *   - Returns a (possibly shorter) subset of `faces` in the same order.
 *   - Never adds, modifies, or reorders detections — filter only.
 *
 * NOTE: real-data verification against the sample baseline has NOT been
 * done yet (MediaPipe cannot run in Node, so this needs in-browser checking).
 * Enable this filter behind a feature flag until in-browser confirmation.
 */
export function rejectFacesCoveredByOCR(
  faces: Detection[],
  ocrTokens: readonly { bbox: BoundingBox }[],
  coverageThreshold = 0.5
): Detection[] {
  if (faces.length === 0 || ocrTokens.length === 0) return faces;
  const tokenBoxes = ocrTokens.map((t) => t.bbox);
  return faces.filter((f) => ocrCoverageRatio(f.bbox, tokenBoxes) < coverageThreshold);
}

/**
 * Deduplicate face detections by IoU. When two boxes overlap above the
 * threshold, keep the one with the higher confidence — we assume both
 * models are looking at the same face and the more confident model has
 * the tighter localisation.
 */
export function mergeFaceDetections(
  detections: Detection[],
  iouThreshold: number
): Detection[] {
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const kept: Detection[] = [];
  for (const candidate of sorted) {
    const duplicate = kept.some((k) => iou(candidate.bbox, k.bbox) > iouThreshold);
    if (!duplicate) kept.push(candidate);
  }
  return kept;
}

function toDetection(d: MpDetection, minConfidence: number): Detection | null {
  if (!d.boundingBox) return null;
  const score = d.categories[0]?.score ?? 0;
  if (score < minConfidence) return null;
  const b = d.boundingBox;
  const bbox = {
    x: Math.max(0, Math.round(b.originX)),
    y: Math.max(0, Math.round(b.originY)),
    w: Math.round(b.width),
    h: Math.round(b.height),
  };
  return {
    kind: 'face',
    bbox,
    maskBbox: bbox,
    value: 'face',
    confidence: score,
  };
}

export function createFaceDetectorRunner(
  opts: FaceDetectorOptions = {}
): FaceDetectorRunner {
  const { wasmBasePath, modelAssetPaths, minConfidence, mergeIoU } = {
    ...DEFAULT_OPTS,
    ...opts,
  };
  let detectorsPromise: Promise<MpFaceDetector[]> | null = null;

  const getDetectors = (): Promise<MpFaceDetector[]> => {
    if (!detectorsPromise) {
      detectorsPromise = (async () => {
        const mp = await loadMediaPipe();
        const fileset = await mp.FilesetResolver.forVisionTasks(wasmBasePath);
        return Promise.all(
          modelAssetPaths.map((modelAssetPath) =>
            mp.FaceDetector.createFromOptions(fileset, {
              baseOptions: { modelAssetPath },
              runningMode: 'IMAGE',
              minDetectionConfidence: minConfidence,
            })
          )
        );
      })();
    }
    return detectorsPromise;
  };

  return {
    async detect(canvas) {
      const detectors = await getDetectors();
      // Run every model on the same canvas and union their detections.
      // MediaPipe's detect() is synchronous once the WASM is warm, but we
      // await the Promise.all pattern anyway for consistency and so that a
      // future async variant (e.g. offscreen-canvas delegate) doesn't need
      // a refactor here.
      const perModel = await Promise.all(
        detectors.map((d) => Promise.resolve(d.detect(canvas)))
      );
      const all: Detection[] = [];
      for (const result of perModel) {
        for (const mpd of result.detections) {
          const det = toDetection(mpd, minConfidence);
          if (det) all.push(det);
        }
      }
      return mergeFaceDetections(all, mergeIoU);
    },
  };
}

export function createMockFaceDetectorRunner(detections: Detection[]): FaceDetectorRunner {
  return { detect: async () => detections };
}
