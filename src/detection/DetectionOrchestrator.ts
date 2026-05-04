/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { detectAadhaar } from './AadhaarDetector';
import { detectPan } from './PanDetector';
import { detectPassportMrz } from './PassportMrzDetector';
import { createOCRRunner, type OCRInput, type OCRRunner } from './OCRRunner';
import type { FaceDetectorRunner } from './FaceDetector';
import type { QrDetectorRunner } from './QrDetector';
import type {
  Detection,
  DetectionResult,
  DocumentDetectionResult,
  OCRToken,
  PageDetectionResult,
} from './types';

export interface RunDetectionOptions {
  ocr?: OCRRunner;
  face?: FaceDetectorRunner;
  qr?: QrDetectorRunner;
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

function textDetections(tokens: OCRToken[]): Detection[] {
  return [
    ...detectAadhaar(tokens),
    ...detectPan(tokens),
    ...detectPassportMrz(tokens),
  ];
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
      const bitmap = await createImageBitmap(input, { imageOrientation: 'from-image' });
      const out = { width: bitmap.width, height: bitmap.height };
      bitmap.close?.();
      return out;
    } catch {
      return { width: 0, height: 0 };
    }
  }
  return { width: 0, height: 0 };
}

async function runDetectors(
  canvas: HTMLCanvasElement | ImageBitmap | Blob | null,
  ocrInput: OCRInput,
  runners: { ocr: OCRRunner; face?: FaceDetectorRunner; qr?: QrDetectorRunner }
): Promise<Detection[]> {
  const tokensPromise = runners.ocr.recognize(ocrInput);

  const canvasForVisual = canvas && !(canvas instanceof Blob) ? canvas : null;
  const facePromise = canvasForVisual && runners.face
    ? runners.face.detect(canvasForVisual)
    : Promise.resolve<Detection[]>([]);
  const qrPromise = canvasForVisual && runners.qr
    ? runners.qr.detect(canvasForVisual)
    : Promise.resolve<Detection[]>([]);

  const [tokens, faces, qrs] = await Promise.all([tokensPromise, facePromise, qrPromise]);
  return [...textDetections(tokens), ...faces, ...qrs];
}

async function runOnImage(
  image: OCRInput,
  runners: { ocr: OCRRunner; face?: FaceDetectorRunner; qr?: QrDetectorRunner }
): Promise<DetectionResult> {
  const started = Date.now();
  const canvasLike =
    image instanceof Blob || typeof image === 'string' ? null : (image as HTMLCanvasElement | ImageBitmap);
  const [source, detections] = await Promise.all([
    measureImageSource(image),
    runDetectors(canvasLike, image, runners),
  ]);
  return {
    detections,
    sourceWidth: source.width,
    sourceHeight: source.height,
    elapsedMs: Date.now() - started,
  };
}

async function runOnPdf(
  blob: Blob,
  runners: { ocr: OCRRunner; face?: FaceDetectorRunner; qr?: QrDetectorRunner },
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
      const detections = await runDetectors(raster.canvas, raster.canvas, runners);
      pages.push({
        pageIndex: i,
        detections,
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

function resolveRunners(opts: RunDetectionOptions) {
  return {
    ocr: opts.ocr ?? createOCRRunner(),
    face: opts.face,
    qr: opts.qr,
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
  return runOnImage(image, resolveRunners(opts));
}

export interface RunDocumentOptions extends RunDetectionOptions {
  pdfPipeline?: PdfPipelineFactory;
  onRaster?: (raster: RasterizedPageLike, pageIndex: number) => void;
}

export async function runDetectionOnDocument(
  input: Blob | File | ImageBitmap | HTMLCanvasElement,
  opts: RunDocumentOptions = {}
): Promise<DocumentDetectionResult> {
  const runners = resolveRunners(opts);
  // scale=3 ≈ 216 DPI from the PDF's 72 DPI base; Tesseract's published
  // accuracy numbers assume ≥200 DPI input. At scale 2 we saw the OCR miss
  // Aadhaar numbers on otherwise-clean UIDAI e-Aadhaar PDFs; scale 3 closes
  // that gap at ~2× the per-page rasterization cost.
  const scale = opts.rasterizeScale ?? 3;

  if (isPdfBlob(input)) {
    if (!opts.pdfPipeline) {
      throw new Error('PDF input requires opts.pdfPipeline to be provided.');
    }
    return runOnPdf(input as Blob, runners, opts.pdfPipeline, scale, opts.onRaster);
  }

  const imageResult = await runOnImage(input as OCRInput, runners);
  return {
    pages: [{ ...imageResult, pageIndex: 0 }],
    totalElapsedMs: imageResult.elapsedMs,
    sourceKind: 'image',
  };
}
