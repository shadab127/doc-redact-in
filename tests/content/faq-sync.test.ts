/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';
import {
  MASK_AADHAAR_FAQ as TS_MASK_AADHAAR,
  REDACT_PAN_FAQ as TS_REDACT_PAN,
  HIDE_AADHAAR_PDF_FAQ as TS_HIDE_AADHAAR_PDF,
} from '@/src/content/faq';
import {
  MASK_AADHAAR_FAQ as MJS_MASK_AADHAAR,
  REDACT_PAN_FAQ as MJS_REDACT_PAN,
  HIDE_AADHAAR_PDF_FAQ as MJS_HIDE_AADHAAR_PDF,
  // @ts-expect-error — .mjs sibling has no .d.ts; this test enforces runtime equality.
} from '@/scripts/faq-data.mjs';

describe('FAQ source of truth', () => {
  it.each([
    ['MASK_AADHAAR_FAQ', TS_MASK_AADHAAR, MJS_MASK_AADHAAR],
    ['REDACT_PAN_FAQ', TS_REDACT_PAN, MJS_REDACT_PAN],
    ['HIDE_AADHAAR_PDF_FAQ', TS_HIDE_AADHAAR_PDF, MJS_HIDE_AADHAAR_PDF],
  ])('%s: TypeScript source and build-script mirror stay byte-identical', (_name, ts, mjs) => {
    expect(mjs).toEqual(ts);
  });
});
