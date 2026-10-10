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
  manualBoxes?: readonly { x: number; y: number; w: number; h: number }[];
}

export interface FlattenOptions {
  jpegQuality?: number;
  signal?: AbortSignal;
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
  quality: number,
  signal?: AbortSignal
): Promise<Uint8Array> {
  signal?.throwIfAborted();
  const blob: Blob | null = await new Promise((resolve, reject) => {
    const onAbort = () => reject(signal?.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      canvas.toBlob((b) => {
        signal?.removeEventListener('abort', onAbort);
        resolve(b);
      }, 'image/jpeg', quality);
    } catch (error) {
      signal?.removeEventListener('abort', onAbort);
      reject(error);
    }
  });
  signal?.throwIfAborted();
  if (!blob) throw new Error('canvas.toBlob returned null');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  signal?.throwIfAborted();
  return bytes;
}

export async function flattenToImageOnlyPdf(
  pages: readonly FlattenablePage[],
  opts: FlattenOptions = {}
): Promise<Uint8Array> {
  const quality = opts.jpegQuality ?? 0.85;
  const signal = opts.signal;
  signal?.throwIfAborted();
  const pdfLib = (await import('pdf-lib')) as unknown as PdfLibModule;
  signal?.throwIfAborted();
  const doc = await pdfLib.PDFDocument.create();

  for (const p of pages) {
    signal?.throwIfAborted();
    const output = document.createElement('canvas');
    output.width = p.canvas.width;
    output.height = p.canvas.height;
    try {
      const ctx = output.getContext('2d');
      if (!ctx) throw new Error('2D context unavailable');
      ctx.drawImage(p.canvas, 0, 0);
      renderMasks(output, p.detections);
      ctx.fillStyle = '#000000';
      for (const box of p.manualBoxes ?? []) {
        ctx.fillRect(box.x, box.y, box.w, box.h);
      }
      const jpeg = await canvasToJpegBytes(output, quality, signal);
      const img = await doc.embedJpg(jpeg);
      signal?.throwIfAborted();
      const page = doc.addPage([p.widthPt, p.heightPt]);
      page.drawImage(img, { x: 0, y: 0, width: p.widthPt, height: p.heightPt });
    } finally {
      output.width = 0;
      output.height = 0;
    }
  }

  signal?.throwIfAborted();
  const bytes = await doc.save();
  signal?.throwIfAborted();
  return bytes;
}
