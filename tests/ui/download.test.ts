/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';
import { redactedFilename } from '@/src/ui/download';

describe('redactedFilename', () => {
  it('replaces a common extension with _redacted.pdf', () => {
    expect(redactedFilename('aadhaar.jpg')).toBe('aadhaar_redacted.pdf');
    expect(redactedFilename('scan.PDF')).toBe('scan_redacted.pdf');
    expect(redactedFilename('photo.jpeg')).toBe('photo_redacted.pdf');
  });

  it('keeps the stem when the file has no extension', () => {
    expect(redactedFilename('my-doc')).toBe('my-doc_redacted.pdf');
  });

  it('falls back to "document" for empty/whitespace input', () => {
    expect(redactedFilename('')).toBe('document_redacted.pdf');
    expect(redactedFilename('   ')).toBe('document_redacted.pdf');
  });

  it('preserves multiple dots — only the final dot is treated as an extension boundary', () => {
    expect(redactedFilename('file.v2.jpg')).toBe('file.v2_redacted.pdf');
  });

  it('treats a leading dot as a dotfile stem rather than an extension', () => {
    expect(redactedFilename('.hidden')).toBe('.hidden_redacted.pdf');
  });

  it('drops a trailing dot, leaving the stem before it', () => {
    expect(redactedFilename('foo.')).toBe('foo_redacted.pdf');
  });
});
