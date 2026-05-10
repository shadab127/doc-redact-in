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
import { preprocessForOCR } from './ImagePreprocessor';
import { createOCRRunner, type OCRInput, type OCRRunner } from './OCRRunner';
import type { FaceDetectorRunner } from './FaceDetector';
import type { QrDetectorRunner } from './QrDetector';
import {
  probeImageRotation,
  rotateCanvas,
  type ProbeRotation,
} from './RotationProbe';
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
  /**
   * If true, the image path will probe 90°/180°/270° rotations when the
   * upright pass yields zero Verhoeff-valid Aadhaar or PAN hits, and re-run
   * detection on the winning rotation. Default false; RedactorApp opts in.
   */
  autoRotateImage?: boolean;
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

function hasTextHit(detections: readonly Detection[]): boolean {
  return detections.some(
    (d) => d.kind === 'aadhaar' || d.kind === 'pan' || d.kind === 'passport_mrz'
  );
}

function hasAadhaarHit(detections: readonly Detection[]): boolean {
  return detections.some((d) => d.kind === 'aadhaar');
}

function hasSuspiciousAadhaar(detections: readonly Detection[]): boolean {
  return detections.some((d) => d.kind === 'aadhaar' && d.suspicious === true);
}

/**
 * Drop any suspicious Aadhaar detection when a clean one exists for the
 * same 12-digit value. The inline path occasionally produces a valid
 * digit string inside a hallucinated-wide bbox that masks empty pixels;
 * once a band re-OCR has produced a cleanly-bounded detection for the
 * same number, the suspicious one adds nothing but a misplaced mask.
 */
function dropSuspiciousWhenCleanExists(detections: readonly Detection[]): Detection[] {
  const cleanValues = new Set<string>();
  for (const d of detections) {
    if (d.kind === 'aadhaar' && !d.suspicious) cleanValues.add(d.value);
  }
  if (cleanValues.size === 0) return detections.slice();
  return detections.filter(
    (d) => !(d.kind === 'aadhaar' && d.suspicious === true && cleanValues.has(d.value))
  );
}

/**
 * Build a horizontal band of the source canvas (no horizontal cropping),
 * translating OCR bboxes back into source coordinates.
 *
 * Rationale: on multi-page PDFs at scale=3, the full-page Tesseract pass
 * can misread a small digit row (the Aadhaar number sits near the middle
 * of the card and occupies only ~2% of page height). Slicing the page
 * into horizontal bands and re-OCRing each band lets Tesseract's layout
 * analyzer focus on a smaller region where the same digits occupy a
 * larger relative fraction — it reads them correctly.
 */
interface BandOrigin {
  x: number;
  y: number;
  scale: number;
}
function buildHorizontalBandCanvas(
  source: HTMLCanvasElement | ImageBitmap,
  y0Frac: number,
  y1Frac: number
): (HTMLCanvasElement & { __bandOrigin: BandOrigin }) | null {
  if (typeof document === 'undefined') return null;
  const y0 = Math.max(0, Math.floor(source.height * y0Frac));
  const y1 = Math.min(source.height, Math.ceil(source.height * y1Frac));
  const bandH = y1 - y0;
  if (bandH <= 0) return null;
  const out = document.createElement('canvas') as HTMLCanvasElement & { __bandOrigin: BandOrigin };
  out.width = source.width;
  out.height = bandH;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source as CanvasImageSource, 0, y0, source.width, bandH, 0, 0, source.width, bandH);
  out.__bandOrigin = { x: 0, y: y0, scale: 1 };
  return out;
}
function translateTokensFromBand(
  tokens: readonly OCRToken[],
  band: HTMLCanvasElement & { __bandOrigin: BandOrigin },
  lineIdBase: number
): OCRToken[] {
  const origin = band.__bandOrigin;
  const s = 1 / origin.scale;
  return tokens.map((t) => ({
    text: t.text,
    bbox: {
      x: origin.x + t.bbox.x * s,
      y: origin.y + t.bbox.y * s,
      w: t.bbox.w * s,
      h: t.bbox.h * s,
    },
    confidence: t.confidence,
    lineId: lineIdBase + t.lineId,
  }));
}

/**
 * Build a preprocessed canvas (grayscale + gaussian blur + global CLAHE) from
 * a source canvas/ImageBitmap. Used only for a fallback OCR pass when the
 * upright raw OCR returned zero text hits — the Aadhaar spike showed CLAHE is
 * too aggressive on already-well-exposed photos to apply by default, but
 * materially rescues washed-out screenshots where raw OCR sees nothing.
 */
function preprocessCanvasForOCR(
  source: HTMLCanvasElement | ImageBitmap
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const w = source.width;
  const h = source.height;
  if (!w || !h) return null;
  const src = document.createElement('canvas');
  src.width = w;
  src.height = h;
  const srcCtx = src.getContext('2d');
  if (!srcCtx) return null;
  srcCtx.drawImage(source, 0, 0);
  let imageData: ImageData;
  try {
    imageData = srcCtx.getImageData(0, 0, w, h);
  } catch {
    return null; // cross-origin tainted canvas
  }
  const processed = preprocessForOCR({ data: imageData.data, width: w, height: h });
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const outCtx = out.getContext('2d');
  if (!outCtx) return null;
  outCtx.putImageData(new ImageData(processed.data, w, h), 0, 0);
  return out;
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
  runners: { ocr: OCRRunner; face?: FaceDetectorRunner; qr?: QrDetectorRunner },
  onStage?: (stage: string, pageIndex?: number, pageTotal?: number) => void,
  pageIndex?: number,
  pageTotal?: number
): Promise<{ detections: Detection[]; tokens: OCRToken[] }> {
  const tokensPromise = runners.ocr.recognize(ocrInput);

  const canvasForVisual = canvas && !(canvas instanceof Blob) ? canvas : null;

  const facePromise = canvasForVisual && runners.face
    ? (onStage?.('Detecting faces…', pageIndex, pageTotal), runners.face.detect(canvasForVisual))
    : Promise.resolve<Detection[]>([]);
  const qrPromise = canvasForVisual && runners.qr
    ? (onStage?.('Scanning QR code…', pageIndex, pageTotal), runners.qr.detect(canvasForVisual))
    : Promise.resolve<Detection[]>([]);

  const [tokens, faces, qrs] = await Promise.all([tokensPromise, facePromise, qrPromise]);
  const text = textDetections(tokens);

  return { detections: [...text, ...faces, ...qrs], tokens };
}

/**
 * Last-chance Aadhaar recovery: slice the source canvas into 3 overlapping
 * horizontal bands and re-OCR each band. On PDFs where the card occupies
 * only a small fraction of the rasterized page (e.g. the back-only panel
 * of an e-Aadhaar printout), the full-page Tesseract pass can misread the
 * digit row entirely. Running OCR on a taller, narrower band lets the
 * layout analyzer lock onto the digits at a larger relative scale.
 *
 * Bounded to 3 OCR passes (one per band). Stops early when (a) no suspicious
 * input detections exist and any band produces an Aadhaar hit, or (b) every
 * suspicious input detection has a clean counterpart in the merged set.
 * Returns the best-seen `refreshed` set even if no band fully succeeded;
 * returns null if no band produced any Aadhaar hit.
 */
async function recoverAadhaarFromBands(
  canvas: HTMLCanvasElement | ImageBitmap,
  tokens: readonly OCRToken[],
  ocr: OCRRunner
): Promise<Detection[] | null> {
  // Three overlapping bands that together cover the full canvas. Each adds
  // ~1-2s of OCR on the cropped band, capped by the inherent Tesseract cost.
  const bandFracs: Array<[number, number]> = [
    [0.3, 0.7],
    [0.0, 0.5],
    [0.5, 1.0],
  ];
  // Collect the suspicious detections from the original tokens so we know
  // which ones to replace. A suspicious detection is "replaced" when a
  // clean detection with the same value AND overlapping bbox appears in
  // the merged set. Matching by value alone is insufficient — the same
  // Aadhaar number can appear twice on a card (front + back), and a
  // clean detection for one instance shouldn't short-circuit recovery
  // of a suspicious detection for the other.
  const originalDetections = textDetections(tokens as OCRToken[]);
  const suspiciousToReplace = originalDetections.filter(
    (d) => d.kind === 'aadhaar' && d.suspicious
  );

  let lineIdBase = (tokens.reduce((m, t) => Math.max(m, t.lineId), -1) ?? -1) + 1000;
  let bestRefreshed: Detection[] | null = null;
  for (const [y0, y1] of bandFracs) {
    const band = buildHorizontalBandCanvas(canvas, y0, y1);
    if (!band) continue;
    const bandTokens = await ocr.recognize(band);
    const translated = translateTokensFromBand(bandTokens, band, lineIdBase);
    lineIdBase += 1000;
    const merged = [...tokens, ...translated];
    const refreshed = textDetections(merged);

    if (!hasAadhaarHit(refreshed)) continue;

    // A suspicious detection is replaced when the refreshed set contains a
    // clean detection with the same value that overlaps the suspicious
    // bbox. (The bbox-overlap dedup in detectAadhaar already drops the
    // suspicious inline hit when a clean triplet overlaps it — so in
    // practice "replaced" means the suspicious detection no longer
    // appears in the refreshed set at all.)
    const suspiciousRemaining = suspiciousToReplace.filter((orig) =>
      refreshed.some(
        (d) => d.kind === 'aadhaar' && d.suspicious && d.value === orig.value
      )
    );
    bestRefreshed = refreshed;
    if (suspiciousRemaining.length === 0) return refreshed;
  }
  return bestRefreshed;
}

async function runOnImage(
  image: OCRInput,
  runners: { ocr: OCRRunner; face?: FaceDetectorRunner; qr?: QrDetectorRunner },
  opts: { autoRotate: boolean; onStage?: (stage: string, pageIndex?: number, pageTotal?: number) => void } = { autoRotate: false }
): Promise<DetectionResult & { effectiveCanvas?: HTMLCanvasElement; rotationApplied?: ProbeRotation }> {
  const started = Date.now();
  const canvasLike =
    image instanceof Blob || typeof image === 'string' ? null : (image as HTMLCanvasElement | ImageBitmap);
  opts.onStage?.('Running OCR…');
  const [source, firstRun] = await Promise.all([
    measureImageSource(image),
    runDetectors(canvasLike, image, runners, opts.onStage),
  ]);
  let effectiveDetections = firstRun.detections;
  let effectiveTokens = firstRun.tokens;
  let effectiveCanvas: HTMLCanvasElement | ImageBitmap | null = canvasLike;

  // Fallback 1: if the upright raw pass found no text and we have a canvas,
  // retry OCR on a contrast-enhanced copy (CLAHE). This rescues washed-out
  // screenshots where raw Tesseract reads the digit row as garbage. We only
  // swap in text detections from the fallback — face/QR results from the
  // raw pass are authoritative and already applied to the correct pixels.
  if (!hasTextHit(effectiveDetections) && canvasLike) {
    const preprocessed = preprocessCanvasForOCR(canvasLike);
    if (preprocessed) {
      opts.onStage?.('Retrying OCR on enhanced image…');
      const tokens = await runners.ocr.recognize(preprocessed);
      const textFromPreprocessed = textDetections(tokens);
      if (textFromPreprocessed.length > 0) {
        const nonText = effectiveDetections.filter(
          (d) => d.kind !== 'aadhaar' && d.kind !== 'pan' && d.kind !== 'passport_mrz'
        );
        effectiveDetections = [...textFromPreprocessed, ...nonText];
        effectiveTokens = tokens;
      }
    }
  }

  // Fallback 2: if auto-rotate is enabled, still no text hit, and the source
  // can be rotated, probe 90/180/270. Rationale: the probe runs up to 3
  // downscaled OCR passes; skipping it when text is already found keeps the
  // happy-path cost at zero.
  let rotationApplied: ProbeRotation | undefined;
  let rotatedCanvas: HTMLCanvasElement | null = null;
  if (opts.autoRotate && !hasTextHit(effectiveDetections) && canvasLike) {
    const winning = await probeImageRotation(canvasLike, runners.ocr);
    if (winning) {
      const rotated = rotateCanvas(canvasLike, winning);
      opts.onStage?.('Running OCR…');
      const rotatedRun = await runDetectors(rotated, rotated, runners, opts.onStage);
      effectiveDetections = rotatedRun.detections;
      effectiveTokens = rotatedRun.tokens;
      effectiveCanvas = rotated;
      rotatedCanvas = rotated;
      rotationApplied = winning;
    }
  }

  // Fallback 3 (last): if we have no Aadhaar hit *or* an existing hit was
  // flagged suspicious (text valid, bbox implausibly wide), re-run OCR on
  // horizontal bands of the canvas. This recovers digits that the default
  // layout segmenter misreads, and corrects bbox hallucinations by merging
  // a cleanly-bounded detection for the same number alongside the bad one.
  const needsRecovery =
    !hasAadhaarHit(effectiveDetections) || hasSuspiciousAadhaar(effectiveDetections);
  if (needsRecovery && effectiveCanvas) {
    const recovered = await recoverAadhaarFromBands(
      effectiveCanvas,
      effectiveTokens,
      runners.ocr
    );
    if (recovered) {
      if (!hasAadhaarHit(effectiveDetections)) {
        // No prior Aadhaar — adopt the recovered text detections wholesale.
        const nonText = effectiveDetections.filter(
          (d) => d.kind !== 'aadhaar' && d.kind !== 'pan' && d.kind !== 'passport_mrz'
        );
        effectiveDetections = [...recovered, ...nonText];
      } else {
        // Prior suspicious hit exists. Merge any *new* recovered Aadhaar
        // detections (values not already in the current set) alongside
        // existing ones, then drop the suspicious ones if a clean same-
        // value counterpart now exists.
        const existingValues = new Set(
          effectiveDetections.filter((d) => d.kind === 'aadhaar').map((d) => d.value)
        );
        const additions = recovered.filter(
          (d) => d.kind === 'aadhaar' && !existingValues.has(d.value)
        );
        const merged = [...effectiveDetections, ...additions];
        // Also replace suspicious detections whose value now has a clean
        // counterpart from the recovery pass.
        const cleanByValue = new Map<string, Detection>();
        for (const d of recovered) {
          if (d.kind === 'aadhaar' && !d.suspicious) cleanByValue.set(d.value, d);
        }
        const replaced = merged.map((d) => {
          if (d.kind === 'aadhaar' && d.suspicious && cleanByValue.has(d.value)) {
            return cleanByValue.get(d.value)!;
          }
          return d;
        });
        effectiveDetections = dropSuspiciousWhenCleanExists(replaced);
      }
    }
  }

  const finalWidth = rotatedCanvas ? rotatedCanvas.width : source.width;
  const finalHeight = rotatedCanvas ? rotatedCanvas.height : source.height;
  return {
    detections: effectiveDetections,
    sourceWidth: finalWidth,
    sourceHeight: finalHeight,
    elapsedMs: Date.now() - started,
    effectiveCanvas: rotatedCanvas ?? undefined,
    rotationApplied,
  };
}

async function runOnPdf(
  blob: Blob,
  runners: { ocr: OCRRunner; face?: FaceDetectorRunner; qr?: QrDetectorRunner },
  pipelineFactory: PdfPipelineFactory,
  scale: number,
  onRaster?: (raster: RasterizedPageLike, pageIndex: number) => void,
  onStage?: (stage: string, pageIndex?: number, pageTotal?: number) => void
): Promise<DocumentDetectionResult> {
  const totalStart = Date.now();
  const buf = new Uint8Array(await blob.arrayBuffer());
  const pipeline = pipelineFactory();
  const info = await pipeline.load(buf);
  const pages: PageDetectionResult[] = [];
  try {
    for (let i = 0; i < info.numPages; i++) {
      const pageStart = Date.now();
      onStage?.(`Rasterising page ${i + 1}/${info.numPages}…`, i, info.numPages);
      const raster = await pipeline.rasterize(i, scale);
      onRaster?.(raster, i);
      onStage?.(`Running OCR…`, i, info.numPages);
      const { detections: pageDetections, tokens } = await runDetectors(
        raster.canvas,
        raster.canvas,
        runners,
        onStage,
        i,
        info.numPages
      );
      let finalDetections = pageDetections;
      // Digit-row fallback for PDFs: same rescue as the image path. PDF
      // rasterization at scale=3 occasionally produces small digits (when
      // the card fills only a fraction of a high-res page), which
      // Tesseract's default layout segmenter drops narrow characters from.
      // Also runs when an existing Aadhaar hit is flagged suspicious — the
      // inline path sometimes produces a valid value inside a hallucinated
      // wide bbox that masks empty pixels instead of the digits.
      const needsRecovery =
        !hasAadhaarHit(finalDetections) || hasSuspiciousAadhaar(finalDetections);
      if (needsRecovery) {
        const recovered = await recoverAadhaarFromBands(
          raster.canvas,
          tokens,
          runners.ocr
        );
        if (recovered) {
          if (!hasAadhaarHit(finalDetections)) {
            const nonText = finalDetections.filter(
              (d) => d.kind !== 'aadhaar' && d.kind !== 'pan' && d.kind !== 'passport_mrz'
            );
            finalDetections = [...recovered, ...nonText];
          } else {
            const existingValues = new Set(
              finalDetections.filter((d) => d.kind === 'aadhaar').map((d) => d.value)
            );
            const additions = recovered.filter(
              (d) => d.kind === 'aadhaar' && !existingValues.has(d.value)
            );
            const merged = [...finalDetections, ...additions];
            const cleanByValue = new Map<string, Detection>();
            for (const d of recovered) {
              if (d.kind === 'aadhaar' && !d.suspicious) cleanByValue.set(d.value, d);
            }
            const replaced = merged.map((d) => {
              if (d.kind === 'aadhaar' && d.suspicious && cleanByValue.has(d.value)) {
                return cleanByValue.get(d.value)!;
              }
              return d;
            });
            finalDetections = dropSuspiciousWhenCleanExists(replaced);
          }
        }
      }
      pages.push({
        pageIndex: i,
        detections: finalDetections,
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
  onStage?: (stage: string, pageIndex?: number, pageTotal?: number) => void;
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
    return runOnPdf(input as Blob, runners, opts.pdfPipeline, scale, opts.onRaster, opts.onStage);
  }

  const imageResult = await runOnImage(input as OCRInput, runners, {
    autoRotate: opts.autoRotateImage ?? false,
    onStage: opts.onStage,
  });
  // If the probe rotated the image, publish the rotated canvas so the UI's
  // preview and the PDF flattener operate on the same pixels the detections
  // were made against. Without this, bboxes sit on a canvas rotated by a
  // different amount than the one shown to the user.
  if (imageResult.effectiveCanvas && opts.onRaster) {
    opts.onRaster(
      {
        pageIndex: 0,
        canvas: imageResult.effectiveCanvas,
        width: imageResult.effectiveCanvas.width,
        height: imageResult.effectiveCanvas.height,
      },
      0
    );
  }
  return {
    pages: [
      {
        detections: imageResult.detections,
        sourceWidth: imageResult.sourceWidth,
        sourceHeight: imageResult.sourceHeight,
        elapsedMs: imageResult.elapsedMs,
        pageIndex: 0,
      },
    ],
    totalElapsedMs: imageResult.elapsedMs,
    sourceKind: 'image',
  };
}
