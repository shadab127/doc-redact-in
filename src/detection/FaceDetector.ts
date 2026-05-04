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
