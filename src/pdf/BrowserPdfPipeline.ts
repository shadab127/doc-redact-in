/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { loadPdf, type PdfDocument } from './PdfLoader';
import { rasterizePage, type RasterizedPage } from './PdfPageRasterizer';
import type {
  PdfPipeline,
  RasterizedPageLike,
} from '@/src/detection/DetectionOrchestrator';

export function createBrowserPdfPipeline(): PdfPipeline {
  let doc: PdfDocument | null = null;

  return {
    async load(data: ArrayBuffer | Uint8Array) {
      doc = await loadPdf(data);
      const pageSizesPt: Array<{ width: number; height: number }> = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const vp = page.getViewport({ scale: 1 });
        pageSizesPt.push({ width: vp.width, height: vp.height });
      }
      return { numPages: doc.numPages, pageSizesPt };
    },
    async rasterize(pageIndex: number, scale: number): Promise<RasterizedPageLike> {
      if (!doc) throw new Error('pipeline not loaded');
      const page = await doc.getPage(pageIndex + 1);
      const raster: RasterizedPage = await rasterizePage(page, pageIndex, { scale });
      return raster;
    },
    async destroy() {
      await doc?.destroy();
      doc = null;
    },
  } satisfies PdfPipeline;
}
