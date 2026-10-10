// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const url = pathToFileURL(resolve('scripts/csp-hashes.mjs')).href;
const { addDocumentCsp, buildHeaders } = await import(url);
const headers = readFileSync('public/_headers', 'utf8');
const policy = headers.match(/Content-Security-Policy: ([^\n]+)/)![1]!;

it('puts a strict per-document policy before scripts and only hashes that document', () => {
  const body = 'window.synthetic=true;';
  const html = `<html><head><script>${body}</script><script src="/app.js"></script></head><body></body></html>`;
  const output = addDocumentCsp(html, policy);
  const hash = createHash('sha256').update(body).digest('base64');
  expect(output).toContain(`'sha256-${hash}'`);
  expect(output.indexOf('http-equiv="Content-Security-Policy"')).toBeLessThan(output.indexOf('<script>'));
  expect(output).toContain("script-src 'self' 'wasm-unsafe-eval'");
  expect(output).not.toContain('frame-ancestors');
  expect(addDocumentCsp(output, policy)).toBe(output);
});

it('keeps anti-framing in HTTP headers and full CSP on worker assets without oversized hash lists', () => {
  const output = buildHeaders(headers, policy);
  expect(output).toContain("Content-Security-Policy: frame-ancestors 'none'");
  expect(output).toContain(`/vendor/*\n  Content-Security-Policy: ${policy}`);
  expect(output).toContain(`/_next/static/*\n  Content-Security-Policy: ${policy}`);
  expect(Math.max(...output.split('\n').map((line: string) => line.length))).toBeLessThanOrEqual(2000);
  expect(output).not.toContain('sha256-');
});

it('handles many inline scripts without putting their hashes into Cloudflare header lines', () => {
  const scripts = Array.from({ length: 150 }, (_, i) => `<script>window.synthetic=${i};</script>`).join('');
  const output = addDocumentCsp(`<html><head>${scripts}</head><body></body></html>`, policy);
  expect(output.match(/sha256-/g)?.length).toBe(150);
  expect(() => buildHeaders(headers, 'x'.repeat(2100))).toThrow('2000');
});

it('fails closed on a missing document head or script policy', () => {
  expect(() => addDocumentCsp('<body></body>', policy)).toThrow();
  expect(() => addDocumentCsp('<head></head>', "default-src 'self'")).toThrow();
});
