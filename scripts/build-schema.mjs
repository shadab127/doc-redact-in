#!/usr/bin/env node
/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 *
 * Generates static JSON-LD schema files in public/schema/. Referenced from
 * each page's metadata.alternates.types['application/ld+json'] so the schema
 * markup works under strict CSP (same-origin link, not inline <script>).
 *
 * Run before `next build` (wired via package.json prebuild).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MASK_AADHAAR_FAQ,
  REDACT_PAN_FAQ,
  HIDE_AADHAAR_PDF_FAQ,
  buildFaqSchema,
} from './faq-data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'public', 'schema');
mkdirSync(outDir, { recursive: true });

const pages = [
  { slug: 'mask-aadhaar-online', faq: MASK_AADHAAR_FAQ },
  { slug: 'redact-pan-card', faq: REDACT_PAN_FAQ },
  { slug: 'hide-aadhaar-number-pdf', faq: HIDE_AADHAAR_PDF_FAQ },
];

for (const { slug, faq } of pages) {
  writeFileSync(
    resolve(outDir, `${slug}.json`),
    JSON.stringify(buildFaqSchema(faq), null, 2) + '\n'
  );
  console.log(`Wrote ${outDir}/${slug}.json (${faq.length} FAQ entries).`);
}
