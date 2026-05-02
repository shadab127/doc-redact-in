/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import type { PdfDocument, PdfPage } from './PdfLoader';

export interface RasterizedPage {
  pageIndex: number;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export interface RasterizeOptions {
  scale?: number;
}

export async function rasterizePage(
  page: PdfPage,
  pageIndex: number,
  opts: RasterizeOptions = {}
): Promise<RasterizedPage> {
  const scale = opts.scale ?? 2;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable for rasterization');
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup?.();
  return { pageIndex, canvas, width: canvas.width, height: canvas.height };
}

export async function rasterizeAllPages(
  doc: PdfDocument,
  opts: RasterizeOptions = {}
): Promise<RasterizedPage[]> {
  const pages: RasterizedPage[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    pages.push(await rasterizePage(page, p - 1, opts));
  }
  return pages;
}
