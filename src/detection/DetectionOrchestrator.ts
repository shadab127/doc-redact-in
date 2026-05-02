/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { detectAadhaar } from './AadhaarDetector';
import { detectPan } from './PanDetector';
import { createOCRRunner, type OCRInput, type OCRRunner } from './OCRRunner';
import type {
  Detection,
  DetectionResult,
  DocumentDetectionResult,
  PageDetectionResult,
} from './types';

export interface RunDetectionOptions {
  ocr?: OCRRunner;
  rasterizeScale?: number;
}

export interface RasterizedPageLike {
  pageIndex: number;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export interface PdfPageSizePt {
  width: number;
  height: number;
}

export interface PdfLoadInfo {
  numPages: number;
  pageSizesPt: readonly PdfPageSizePt[];
}

export interface PdfPipeline {
  load(data: ArrayBuffer | Uint8Array): Promise<PdfLoadInfo>;
  rasterize(pageIndex: number, scale: number): Promise<RasterizedPageLike>;
  destroy(): Promise<void>;
}

export type PdfPipelineFactory = () => PdfPipeline;

function isPdfBlob(input: unknown): boolean {
  if (typeof Blob === 'undefined' || !(input instanceof Blob)) return false;
  if (input.type === 'application/pdf') return true;
  if (typeof File !== 'undefined' && input instanceof File) {
    return /\.pdf$/i.test(input.name);
  }
  return false;
}

function mergeDetections(tokens: readonly import('./types').OCRToken[]): Detection[] {
  return [...detectAadhaar(tokens as import('./types').OCRToken[]), ...detectPan(tokens as import('./types').OCRToken[])];
}

async function measureImageSource(
  input: OCRInput
): Promise<{ width: number; height: number }> {
  if (typeof ImageBitmap !== 'undefined' && input instanceof ImageBitmap) {
    return { width: input.width, height: input.height };
  }
  if (
    typeof HTMLCanvasElement !== 'undefined' &&
    input instanceof HTMLCanvasElement
  ) {
    return { width: input.width, height: input.height };
  }
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    try {
      const bitmap = await createImageBitmap(input);
      const out = { width: bitmap.width, height: bitmap.height };
      bitmap.close?.();
      return out;
    } catch {
      return { width: 0, height: 0 };
    }
  }
  return { width: 0, height: 0 };
}

async function runOnImage(
  image: OCRInput,
  ocr: OCRRunner
): Promise<DetectionResult> {
  const started = Date.now();
  const [tokens, source] = await Promise.all([
    ocr.recognize(image),
    measureImageSource(image),
  ]);
  return {
    detections: mergeDetections(tokens),
    sourceWidth: source.width,
    sourceHeight: source.height,
    elapsedMs: Date.now() - started,
  };
}

async function runOnPdf(
  blob: Blob,
  ocr: OCRRunner,
  pipelineFactory: PdfPipelineFactory,
  scale: number,
  onRaster?: (raster: RasterizedPageLike, pageIndex: number) => void
): Promise<DocumentDetectionResult> {
  const totalStart = Date.now();
  const buf = new Uint8Array(await blob.arrayBuffer());
  const pipeline = pipelineFactory();
  const info = await pipeline.load(buf);
  const pages: PageDetectionResult[] = [];
  try {
    for (let i = 0; i < info.numPages; i++) {
      const pageStart = Date.now();
      const raster = await pipeline.rasterize(i, scale);
      onRaster?.(raster, i);
      const tokens = await ocr.recognize(raster.canvas);
      pages.push({
        pageIndex: i,
        detections: mergeDetections(tokens),
        sourceWidth: raster.width,
        sourceHeight: raster.height,
        elapsedMs: Date.now() - pageStart,
      });
    }
  } finally {
    await pipeline.destroy();
  }
  return {
    pages,
    totalElapsedMs: Date.now() - totalStart,
    sourceKind: 'pdf',
    pageSizesPt: info.pageSizesPt,
  };
}

export async function runDetection(
  image: OCRInput,
  opts: RunDetectionOptions = {}
): Promise<DetectionResult> {
  if (isPdfBlob(image)) {
    throw new Error(
      'For PDF input, call runDetectionOnDocument(file, { pdfPipeline }) instead of runDetection.'
    );
  }
  const ocr = opts.ocr ?? createOCRRunner();
  return runOnImage(image, ocr);
}

export interface RunDocumentOptions extends RunDetectionOptions {
  pdfPipeline?: PdfPipelineFactory;
  onRaster?: (raster: RasterizedPageLike, pageIndex: number) => void;
}

export async function runDetectionOnDocument(
  input: Blob | File | ImageBitmap | HTMLCanvasElement,
  opts: RunDocumentOptions = {}
): Promise<DocumentDetectionResult> {
  const ocr = opts.ocr ?? createOCRRunner();
  const scale = opts.rasterizeScale ?? 2;

  if (isPdfBlob(input)) {
    if (!opts.pdfPipeline) {
      throw new Error('PDF input requires opts.pdfPipeline to be provided.');
    }
    return runOnPdf(input as Blob, ocr, opts.pdfPipeline, scale, opts.onRaster);
  }

  const imageResult = await runOnImage(input as OCRInput, ocr);
  return {
    pages: [{ ...imageResult, pageIndex: 0 }],
    totalElapsedMs: imageResult.elapsedMs,
    sourceKind: 'image',
  };
}
