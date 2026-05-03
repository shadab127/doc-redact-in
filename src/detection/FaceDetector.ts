/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import type { Detection } from './types';

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
  /** Path to the BlazeFace short-range tflite model, same-origin. */
  modelAssetPath?: string;
  /** Score threshold below which detections are dropped. */
  minConfidence?: number;
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
  modelAssetPath: '/vendor/mediapipe/blaze_face_short_range.tflite',
  minConfidence: 0.5,
};

export function createFaceDetectorRunner(
  opts: FaceDetectorOptions = {}
): FaceDetectorRunner {
  const { wasmBasePath, modelAssetPath, minConfidence } = {
    ...DEFAULT_OPTS,
    ...opts,
  };
  let detectorPromise: Promise<MpFaceDetector> | null = null;

  const getDetector = (): Promise<MpFaceDetector> => {
    if (!detectorPromise) {
      detectorPromise = (async () => {
        const mp = await loadMediaPipe();
        const fileset = await mp.FilesetResolver.forVisionTasks(wasmBasePath);
        return mp.FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath },
          runningMode: 'IMAGE',
          minDetectionConfidence: minConfidence,
        });
      })();
    }
    return detectorPromise;
  };

  return {
    async detect(canvas) {
      const detector = await getDetector();
      // BlazeFace short-range expects small input and does its own resize.
      // Pass the canvas directly; MediaPipe converts via GPU when available.
      const result = detector.detect(canvas);
      return result.detections
        .filter((d) => !!d.boundingBox && (d.categories[0]?.score ?? 0) >= minConfidence)
        .map<Detection>((d) => {
          const b = d.boundingBox!;
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
            confidence: d.categories[0]?.score ?? 0,
          };
        });
    },
  };
}

export function createMockFaceDetectorRunner(detections: Detection[]): FaceDetectorRunner {
  return { detect: async () => detections };
}
