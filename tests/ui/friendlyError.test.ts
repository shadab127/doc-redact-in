/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';
import { friendlyError } from '@/src/ui/friendlyError';

describe('friendlyError', () => {
  it('maps "source image could not be decoded" to the image-read message', () => {
    expect(friendlyError(new Error('Error: The source image could not be decoded.'))).toBe(
      "Couldn't read this image. Try a JPG or PNG export, or a clearer photo."
    );
  });

  it('maps createImageBitmap errors to the image-read message', () => {
    expect(friendlyError(new Error('createImageBitmap failed: unsupported format'))).toBe(
      "Couldn't read this image. Try a JPG or PNG export, or a clearer photo."
    );
  });

  it('maps InvalidStateError to the image-read message', () => {
    expect(friendlyError(new Error('InvalidStateError: object is in the wrong state'))).toBe(
      "Couldn't read this image. Try a JPG or PNG export, or a clearer photo."
    );
  });

  it('maps "password" + "pdf" to the password-protected message', () => {
    expect(friendlyError(new Error('This PDF requires a password to open.'))).toBe(
      'This PDF is password-protected. Remove the password and try again.'
    );
  });

  it('maps "encrypted" to the password-protected message', () => {
    expect(friendlyError(new Error('Document is encrypted and cannot be processed.'))).toBe(
      'This PDF is password-protected. Remove the password and try again.'
    );
  });

  it('maps "invalid pdf" to the corrupted message', () => {
    expect(friendlyError(new Error('Invalid PDF structure at offset 0'))).toBe(
      "This PDF couldn't be opened. The file may be corrupted."
    );
  });

  it('maps "corrupt" to the corrupted message', () => {
    expect(friendlyError(new Error('The file appears to be corrupt.'))).toBe(
      "This PDF couldn't be opened. The file may be corrupted."
    );
  });

  it('maps InvalidPDFException to the corrupted message', () => {
    expect(friendlyError(new Error('InvalidPDFException: missing EOF marker'))).toBe(
      "This PDF couldn't be opened. The file may be corrupted."
    );
  });

  it('maps "too large" to the file-size message', () => {
    expect(friendlyError(new Error('File is too large to process.'))).toBe(
      'File is too large. The 20 MB limit keeps everything in-browser.'
    );
  });

  it('maps "exceeds" to the file-size message', () => {
    expect(friendlyError(new Error('Upload exceeds the maximum allowed size.'))).toBe(
      'File is too large. The 20 MB limit keeps everything in-browser.'
    );
  });

  it('returns the generic fallback for an unrecognised message', () => {
    expect(friendlyError(new Error('Some random internal vendor error xyz'))).toBe(
      'Something went wrong while processing this file. Try a different document.'
    );
  });

  it('handles a non-Error thrown value via the fallback', () => {
    expect(friendlyError('boom')).toBe(
      'Something went wrong while processing this file. Try a different document.'
    );
  });
});
