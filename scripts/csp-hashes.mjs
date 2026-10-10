// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const INLINE_SCRIPT_RE = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;

export function addDocumentCsp(html, template) {
  const clean = html.replace(/<meta data-docredact-csp="true"[^>]*>/g, '');
  const hashes = new Set();
  for (const match of clean.matchAll(INLINE_SCRIPT_RE)) {
    if (match[1].trim()) hashes.add(`'sha256-${createHash('sha256').update(match[1], 'utf8').digest('base64')}'`);
  }
  const directives = template.split(';').map((part) => part.trim())
    .filter((part) => part && !part.startsWith('frame-ancestors '));
  const policy = (directives.join('; ') + ';')
    .replace(/(script-src [^;]*)(;)/, `$1 ${[...hashes].sort().join(' ')}$2`);
  if (!/<head(?:\s[^>]*)?>/.test(clean)) throw new Error('HTML document is missing a head element');
  if (!policy.includes("script-src 'self'")) throw new Error('Missing strict script policy');
  const escaped = policy.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return clean.replace(/<head(?:\s[^>]*)?>/, `$&<meta data-docredact-csp="true" http-equiv="Content-Security-Policy" content="${escaped}">`);
}

export function buildHeaders(template, csp) {
  const headers = template.replace(/Content-Security-Policy: [^\n]+/, "Content-Security-Policy: frame-ancestors 'none'")
    .replace(/(\/(?:_next\/static|vendor)\/\*\n)/g, `$1  Content-Security-Policy: ${csp}\n`);
  if (headers.split('\n').some((line) => line.length > 2000)) throw new Error('Cloudflare header line exceeds 2000 characters');
  return headers;
}

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else if (entry.isFile() && file.endsWith('.html')) files.push(file);
  }
  return files;
}

async function main() {
  const out = path.resolve('out');
  const template = await readFile(path.resolve('public/_headers'), 'utf8');
  const csp = template.match(/Content-Security-Policy: ([^\n]+)/)?.[1];
  if (!csp) throw new Error('Missing source CSP');
  const files = await walk(out);
  for (const file of files) {
    await writeFile(file, addDocumentCsp(await readFile(file, 'utf8'), csp));
  }
  await writeFile(path.join(out, '_headers'), buildHeaders(template, csp));
  console.log(`csp-hashes: secured ${files.length} HTML documents; Cloudflare headers remain within the 2000-character limit`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
