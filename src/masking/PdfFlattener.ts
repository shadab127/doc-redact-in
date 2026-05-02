/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import type { Detection } from '@/src/detection/types';
import { renderMasks } from './CanvasMaskRenderer';

export interface FlattenablePage {
  canvas: HTMLCanvasElement;
  widthPt: number;
  heightPt: number;
  detections: readonly Detection[];
}

export interface FlattenOptions {
  jpegQuality?: number;
}

interface PdfLibModule {
  PDFDocument: {
    create(): Promise<PdfDocumentLike>;
  };
}

interface PdfDocumentLike {
  embedJpg(data: Uint8Array): Promise<PdfImageLike>;
  addPage(size: [number, number]): PdfPageLike;
  save(): Promise<Uint8Array>;
}

interface PdfPageLike {
  drawImage(
    image: PdfImageLike,
    options: { x: number; y: number; width: number; height: number }
  ): void;
}

interface PdfImageLike {
  width: number;
  height: number;
}

async function canvasToJpegBytes(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Uint8Array> {
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
  );
  if (!blob) throw new Error('canvas.toBlob returned null');
  return new Uint8Array(await blob.arrayBuffer());
}

export async function flattenToImageOnlyPdf(
  pages: readonly FlattenablePage[],
  opts: FlattenOptions = {}
): Promise<Uint8Array> {
  const quality = opts.jpegQuality ?? 0.85;
  const pdfLib = (await import('pdf-lib')) as unknown as PdfLibModule;
  const doc = await pdfLib.PDFDocument.create();

  for (const p of pages) {
    renderMasks(p.canvas, p.detections);
    const jpeg = await canvasToJpegBytes(p.canvas, quality);
    const img = await doc.embedJpg(jpeg);
    const page = doc.addPage([p.widthPt, p.heightPt]);
    page.drawImage(img, { x: 0, y: 0, width: p.widthPt, height: p.heightPt });
  }

  return doc.save();
}
