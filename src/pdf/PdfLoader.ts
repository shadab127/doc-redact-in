/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */

export interface PdfPage {
  getViewport(params: { scale: number }): { width: number; height: number };
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }): { promise: Promise<void> };
  cleanup?: () => void;
}

export interface PdfDocument {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}

interface PdfjsModule {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: {
    data: ArrayBuffer | Uint8Array;
    isEvalSupported?: boolean;
    standardFontDataUrl?: string;
  }): { promise: Promise<PdfDocument> };
  version: string;
}

let loaded: Promise<PdfjsModule> | null = null;

// Same-origin paths to vendored pdf.js assets (see scripts/prepare-vendor-assets.mjs).
// workerSrc is mandatory in pdfjs-dist ≥4 — even "disableWorker: true" still
// reads this global during setup and throws if it's unset.
const PDFJS_WORKER_SRC = '/vendor/pdfjs/pdf.worker.min.mjs';
const PDFJS_STANDARD_FONT_URL = '/vendor/pdfjs/standard_fonts/';

async function loadPdfjs(): Promise<PdfjsModule> {
  if (!loaded) {
    loaded = (async () => {
      const mod = (await import('pdfjs-dist')) as unknown as PdfjsModule;
      mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
      return mod;
    })();
  }
  return loaded;
}

// pdf.js runs its worker from our own origin (CSP worker-src 'self' blob:).
// Keeps the "nothing leaves your device" invariant intact for PDF input.
export async function loadPdf(data: ArrayBuffer | Uint8Array): Promise<PdfDocument> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    standardFontDataUrl: PDFJS_STANDARD_FONT_URL,
  });
  return task.promise;
}
