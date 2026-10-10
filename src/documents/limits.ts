// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_PAGES = 10;
export const MAX_PAGE_PIXELS = 40_000_000;
export const MAX_DOCUMENT_PIXELS = 80_000_000;
export const DOCUMENT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf';
export const DOCUMENT_LIMITS_LABEL = 'JPG, PNG, WebP or PDF · up to 20 MB and 10 pages. Large images or PDFs may exceed the memory budget.';

export class DocumentInputError extends Error {}

export function validateDocumentFile(file: Pick<File, 'size' | 'type' | 'name'>): void {
  if (file.size > MAX_FILE_BYTES) {
    throw new DocumentInputError('File is too large. Choose a file up to 20 MB.');
  }
  const supported = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type);
  const extensionFallback = (!file.type || file.type === 'application/octet-stream') && /\.(jpe?g|png|webp|pdf)$/i.test(file.name);
  if (!supported && !extensionFallback) {
    throw new DocumentInputError('Unsupported file type. Choose a JPG, PNG, WebP or PDF.');
  }
}

export function validatePageCount(count: number): void {
  if (!Number.isInteger(count) || count < 1 || count > MAX_PDF_PAGES) {
    throw new DocumentInputError('This PDF has too many pages. Choose up to 10 pages.');
  }
}

export function validateRasterBudget(width: number, height: number, usedPixels = 0): number {
  const pixels = Math.ceil(width) * Math.ceil(height);
  if (!Number.isFinite(pixels) || width <= 0 || height <= 0 || pixels > MAX_PAGE_PIXELS || usedPixels + pixels > MAX_DOCUMENT_PIXELS) {
    throw new DocumentInputError('This document needs too much memory. Use a smaller image or split the PDF into fewer pages.');
  }
  return usedPixels + pixels;
}
