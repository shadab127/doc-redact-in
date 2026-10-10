// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { describe, expect, it } from 'vitest';
import {
  MAX_FILE_BYTES, MAX_PAGE_PIXELS, MAX_DOCUMENT_PIXELS,
  validateDocumentFile, validatePageCount, validateRasterBudget,
} from '@/src/documents/limits';
import { friendlyError } from '@/src/ui/friendlyError';

describe('document input limits', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])('accepts %s at the byte limit', (type) => {
    expect(() => validateDocumentFile({ size: MAX_FILE_BYTES, type, name: 'fixture' })).not.toThrow();
  });

  it('rejects one byte above the limit', () => {
    expect(() => validateDocumentFile({ size: MAX_FILE_BYTES + 1, type: 'image/png', name: 'fixture.png' })).toThrow('20 MB');
  });

  it.each(['fixture.PDF', 'fixture.WebP'])('accepts %s when MIME is missing', (name) => {
    expect(() => validateDocumentFile({ size: 100, type: '', name })).not.toThrow();
  });

  it('allows the large two-page PDF geometry with 10% extra width and height at 3×', () => {
    let pixels = 0;
    for (const [width, height] of [[2240, 1415], [2179, 1449]]) {
      pixels = validateRasterBudget(width! * 3 * 1.1, height! * 3 * 1.1, pixels);
    }
    expect(pixels).toBeLessThan(MAX_DOCUMENT_PIXELS);
    expect(pixels).toBeGreaterThan(68_000_000);
  });

  it('rejects unsupported types even with a misleading extension', () => {
    expect(() => validateDocumentFile({ size: 100, type: 'image/heic', name: 'fixture.png' })).toThrow('Unsupported');
  });

  it('enforces the PDF page count', () => {
    expect(() => validatePageCount(10)).not.toThrow();
    expect(() => validatePageCount(11)).toThrow('10 pages');
  });

  it('enforces per-page and cumulative pixel budgets', () => {
    expect(validateRasterBudget(2000, MAX_PAGE_PIXELS / 2000)).toBe(MAX_PAGE_PIXELS);
    expect(() => validateRasterBudget(2000, MAX_PAGE_PIXELS / 2000 + 1)).toThrow('memory');
    expect(() => validateRasterBudget(100, 100, MAX_DOCUMENT_PIXELS)).toThrow('memory');
    expect(() => validateRasterBudget(Infinity, 100)).toThrow('memory');
  });

  it('preserves specific limit guidance in friendly errors', () => {
    try { validatePageCount(11); } catch (e) {
      expect(friendlyError(e)).toContain('10 pages');
    }
  });
});
