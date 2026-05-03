/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import type { OCRToken } from './types';

export interface OCRRunner {
  recognize(image: OCRInput): Promise<OCRToken[]>;
  terminate(): Promise<void>;
}

export type OCRInput = ImageBitmap | HTMLCanvasElement | Blob | File | string;

interface TesseractLikeWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  line?: { baseline?: unknown };
}

interface TesseractLikeLine {
  words: TesseractLikeWord[];
}

interface TesseractLikeResult {
  data: {
    lines: TesseractLikeLine[];
  };
}

interface TesseractLikeWorker {
  recognize(input: OCRInput): Promise<TesseractLikeResult>;
  terminate(): Promise<void>;
}

interface TesseractWorkerOptions {
  workerPath?: string;
  corePath?: string;
  langPath?: string;
  workerBlobURL?: boolean;
}

interface TesseractModule {
  createWorker(
    lang: string,
    oem?: number,
    options?: TesseractWorkerOptions
  ): Promise<TesseractLikeWorker>;
}

async function loadTesseract(): Promise<TesseractModule> {
  return (await import('tesseract.js')) as unknown as TesseractModule;
}

// Same-origin paths for the three assets Tesseract.js would otherwise pull
// from cdn.jsdelivr.net. These files are vendored into public/vendor/ by
// scripts/prepare-vendor-assets.mjs so that the redaction flow never makes
// a cross-origin request (required by our CSP and the core privacy claim).
const TESSERACT_PATHS: TesseractWorkerOptions = {
  workerPath: '/vendor/tesseract/worker.min.js',
  corePath: '/vendor/tesseract-core',
  langPath: '/vendor/tesseract-lang',
};

export function createOCRRunner(): OCRRunner {
  let workerPromise: Promise<TesseractLikeWorker> | null = null;

  const getWorker = (): Promise<TesseractLikeWorker> => {
    if (!workerPromise) {
      workerPromise = loadTesseract().then((t) =>
        t.createWorker('eng', 1, TESSERACT_PATHS)
      );
    }
    return workerPromise;
  };

  return {
    async recognize(input: OCRInput): Promise<OCRToken[]> {
      const worker = await getWorker();
      const result = await worker.recognize(input);
      const tokens: OCRToken[] = [];
      result.data.lines.forEach((line, lineIdx) => {
        for (const word of line.words) {
          const text = word.text.trim();
          if (!text) continue;
          tokens.push({
            text,
            bbox: {
              x: word.bbox.x0,
              y: word.bbox.y0,
              w: word.bbox.x1 - word.bbox.x0,
              h: word.bbox.y1 - word.bbox.y0,
            },
            confidence: word.confidence / 100,
            lineId: lineIdx,
          });
        }
      });
      return tokens;
    },

    async terminate(): Promise<void> {
      if (!workerPromise) return;
      const w = await workerPromise;
      workerPromise = null;
      await w.terminate();
    },
  };
}

export function createMockOCRRunner(tokens: OCRToken[]): OCRRunner {
  return {
    recognize: async () => tokens,
    terminate: async () => {},
  };
}
