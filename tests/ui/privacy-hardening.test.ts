// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

describe('privacy safeguards', () => {
  it('does not load optional third-party analytics, even when an old token is configured', () => {
    const layout = read('app/layout.tsx');
    expect(layout).not.toContain('CF_ANALYTICS_TOKEN');
    expect(layout).not.toContain('cloudflareinsights.com');
    const headers = read('public/_headers');
    expect(headers).toContain("script-src 'self' 'wasm-unsafe-eval';");
    expect(headers).toContain("connect-src 'self' data:;");
    expect(headers).not.toContain('cloudflareinsights.com');
  });

  it.each(['accuracy-harness', 'local-samples'])('disables sensitive artifacts for %s', (name) => {
    expect(read(`tests/e2e/${name}.spec.ts`)).toContain("test.use({ trace: 'off', screenshot: 'off', video: 'off' });");
  });

  it('isolates private test artifacts and uses anonymous sample names', () => {
    const runner = read('scripts/test-private-samples.mjs');
    expect(runner).toContain('mkdtemp');
    expect(runner).toContain('tmpdir()');
    expect(runner).toContain("PLAYWRIGHT_NO_COPY_PROMPT: '1'");
    expect(runner).toContain('await rm(output');
    const samples = read('tests/e2e/local-samples.spec.ts');
    expect(samples).toContain('name: `${sample}${extension}`');
    expect(samples).toContain('await download.delete()');
    expect(samples).not.toContain('sample: name');
    expect(samples).not.toContain('${name}');
    expect(read('playwright.config.ts')).toContain('Use npm run test:e2e:private');
  });

  it('discloses memory retention and matches waitlist expiration configuration', () => {
    const policy = read('app/privacy/page.tsx');
    expect(policy).toContain('automatic expiration after 90 days');
    expect(policy).toContain('Resend');
    expect(policy).toContain('Start');
    expect(policy).toContain('forensic erasure');
    expect(read('workers/wrangler.toml')).toContain('WAITLIST_RETENTION_SECONDS = "7776000"');
  });
});
