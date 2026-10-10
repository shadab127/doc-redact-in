// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/content/faq.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const faq = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

export const MASK_AADHAAR_FAQ = faq.MASK_AADHAAR_FAQ;
export const REDACT_PAN_FAQ = faq.REDACT_PAN_FAQ;
export const HIDE_AADHAAR_PDF_FAQ = faq.HIDE_AADHAAR_PDF_FAQ;
export const buildFaqSchema = faq.buildFaqSchema;
