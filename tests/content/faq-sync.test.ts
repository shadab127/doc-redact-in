/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';
import { MASK_AADHAAR_FAQ as TS_FAQ } from '@/src/content/faq';
// @ts-expect-error — .mjs sibling has no .d.ts; this test enforces runtime equality.
import { MASK_AADHAAR_FAQ as MJS_FAQ } from '@/scripts/faq-data.mjs';

describe('FAQ source of truth', () => {
  it('TypeScript source and build-script mirror stay byte-identical', () => {
    expect(MJS_FAQ).toEqual(TS_FAQ);
  });
});
