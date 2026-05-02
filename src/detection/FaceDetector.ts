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
  modelsUrl?: string;
  minConfidence?: number;
  inputSize?: number;
}

interface FaceApiBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FaceApiDetection {
  box: FaceApiBox;
  score: number;
}

interface TinyFaceDetectorOptions {
  new (opts: { inputSize: number; scoreThreshold: number }): unknown;
}

interface FaceApiNets {
  tinyFaceDetector: {
    loadFromUri(url: string): Promise<void>;
    isLoaded: boolean;
  };
}

interface FaceApiModule {
  nets: FaceApiNets;
  TinyFaceDetectorOptions: TinyFaceDetectorOptions;
  detectAllFaces(
    input: HTMLCanvasElement | ImageBitmap,
    options: unknown
  ): Promise<FaceApiDetection[]>;
}

async function loadFaceApi(): Promise<FaceApiModule> {
  return (await import('@vladmandic/face-api')) as unknown as FaceApiModule;
}

const DEFAULT_OPTS: Required<FaceDetectorOptions> = {
  modelsUrl: '/models',
  minConfidence: 0.6,
  inputSize: 416,
};

export function createFaceDetectorRunner(
  opts: FaceDetectorOptions = {}
): FaceDetectorRunner {
  const { modelsUrl, minConfidence, inputSize } = { ...DEFAULT_OPTS, ...opts };
  let loaded: Promise<FaceApiModule> | null = null;

  const getFaceApi = async (): Promise<FaceApiModule> => {
    if (!loaded) {
      loaded = (async () => {
        const mod = await loadFaceApi();
        if (!mod.nets.tinyFaceDetector.isLoaded) {
          await mod.nets.tinyFaceDetector.loadFromUri(modelsUrl);
        }
        return mod;
      })();
    }
    return loaded;
  };

  return {
    async detect(canvas) {
      const api = await getFaceApi();
      const raw = await api.detectAllFaces(
        canvas,
        new (api.TinyFaceDetectorOptions as unknown as new (
          o: { inputSize: number; scoreThreshold: number }
        ) => unknown)({
          inputSize,
          scoreThreshold: minConfidence,
        })
      );
      return raw
        .filter((d) => d.score >= minConfidence)
        .map<Detection>((d) => {
          const bbox = {
            x: Math.max(0, Math.round(d.box.x)),
            y: Math.max(0, Math.round(d.box.y)),
            w: Math.round(d.box.width),
            h: Math.round(d.box.height),
          };
          return {
            kind: 'face',
            bbox,
            maskBbox: bbox,
            value: 'face',
            confidence: d.score,
          };
        });
    },
  };
}

export function createMockFaceDetectorRunner(detections: Detection[]): FaceDetectorRunner {
  return { detect: async () => detections };
}
