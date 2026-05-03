/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */

// Post-build: compute SHA-256 of every inline <script> Next.js emits under
// out/**/*.html and splice the hashes into the script-src directive of
// out/_headers. This keeps the production CSP strict (no 'unsafe-inline')
// while still permitting the React hydration bootstrap to run.
//
// Runs after `next build`. If you change the CSP template, edit
// public/_headers — this script only rewrites script-src.

import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve('out');
const HEADERS_FILE = path.join(OUT_DIR, '_headers');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(full)));
    else if (e.isFile() && full.endsWith('.html')) files.push(full);
  }
  return files;
}

// Match <script> tags that have no src= attribute (i.e., inline bodies).
// Next.js emits these with plain <script> (no attributes), which makes this
// regex safe; if the upstream output ever changes, the no-outbound-network
// e2e probe will catch the regression because the site stops hydrating.
const INLINE_SCRIPT_RE = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;

function sha256Base64(s) {
  return createHash('sha256').update(s, 'utf8').digest('base64');
}

async function main() {
  const htmlFiles = await walk(OUT_DIR);
  const hashes = new Set();

  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    for (const m of html.matchAll(INLINE_SCRIPT_RE)) {
      const body = m[1];
      if (body.trim().length === 0) continue;
      hashes.add(`'sha256-${sha256Base64(body)}'`);
    }
  }

  const headers = await readFile(HEADERS_FILE, 'utf8');
  const hashList = [...hashes].sort().join(' ');

  // Splice hashes into the script-src directive. The source of truth CSP
  // lives in public/_headers and does not contain any sha256- tokens; this
  // script is the only producer of them in out/_headers.
  const rewritten = headers.replace(
    /(script-src [^;]*?)(;)/,
    (match, prefix, semi) => {
      if (prefix.includes("'sha256-")) return match; // idempotent
      return `${prefix} ${hashList}${semi}`;
    }
  );

  if (rewritten === headers) {
    throw new Error(
      'csp-hashes: failed to locate script-src directive in out/_headers'
    );
  }

  await writeFile(HEADERS_FILE, rewritten);
  console.log(
    `csp-hashes: wrote ${hashes.size} inline-script hash(es) into ${HEADERS_FILE}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
