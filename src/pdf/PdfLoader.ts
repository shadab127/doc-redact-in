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
  getDocument(src: {
    data: ArrayBuffer | Uint8Array;
    disableWorker?: boolean;
    isEvalSupported?: boolean;
  }): { promise: Promise<PdfDocument> };
  version: string;
}

let loaded: Promise<PdfjsModule> | null = null;

async function loadPdfjs(): Promise<PdfjsModule> {
  if (!loaded) {
    loaded = (async () => {
      return (await import('pdfjs-dist')) as unknown as PdfjsModule;
    })();
  }
  return loaded;
}

// pdf.js runs on the main thread here (disableWorker: true). W3 may move it
// to a real Worker once we ship a same-origin worker bundle that satisfies
// our CSP ('script-src self wasm-unsafe-eval'). Main-thread mode is fine
// for MVP — ID docs are 1–5 pages.
export async function loadPdf(data: ArrayBuffer | Uint8Array): Promise<PdfDocument> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data, disableWorker: true, isEvalSupported: false });
  return task.promise;
}
