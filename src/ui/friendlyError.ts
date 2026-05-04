/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */

export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);

  if (
    /source image could not be decoded/i.test(msg) ||
    /createImageBitmap/i.test(msg) ||
    /InvalidStateError/i.test(msg)
  ) {
    return "Couldn't read this image. Try a JPG or PNG export, or a clearer photo.";
  }

  if ((/password/i.test(msg) && /pdf/i.test(msg)) || /encrypted/i.test(msg)) {
    return 'This PDF is password-protected. Remove the password and try again.';
  }

  if (/invalid pdf/i.test(msg) || /corrupt/i.test(msg) || /InvalidPDFException/i.test(msg)) {
    return "This PDF couldn't be opened. The file may be corrupted.";
  }

  if (/too large/i.test(msg) || /exceeds/i.test(msg)) {
    return 'File is too large. The 20 MB limit keeps everything in-browser.';
  }

  return 'Something went wrong while processing this file. Try a different document.';
}
