// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { afterEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const moduleUrl = pathToFileURL(resolve('scripts/prepare-vendor-assets.mjs')).href;
const { copyAsset, fetchWithHashCheck } = await import(moduleUrl);
const directories: string[] = [];
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

async function directory() {
  const dir = await mkdtemp(join(tmpdir(), 'docredact-vendor-test-'));
  directories.push(dir);
  return dir;
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

it('refreshes stale package assets and repairs partial directories', async () => {
  const dir = await directory();
  const source = join(dir, 'source');
  const target = join(dir, 'target');
  await mkdir(source);
  await mkdir(target);
  await writeFile(join(source, 'worker.js'), 'new worker');
  await writeFile(join(source, 'core.wasm'), 'new wasm');
  await writeFile(join(target, 'worker.js'), 'old worker');
  await copyAsset(source, target);
  expect(await readFile(join(target, 'worker.js'), 'utf8')).toBe('new worker');
  expect(await readFile(join(target, 'core.wasm'), 'utf8')).toBe('new wasm');
});

it('checks pinned hashes even for existing non-empty assets without using the network', async () => {
  const dir = await directory();
  const asset = join(dir, 'model');
  await writeFile(asset, 'verified model');
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  expect((await fetchWithHashCheck('https://example.test/model', asset, hash('verified model'))).action).toBe('verified');
  await writeFile(asset, 'tampered model');
  await expect(fetchWithHashCheck('https://example.test/model', asset, hash('verified model'))).rejects.toThrow('integrity');
  expect(fetcher).not.toHaveBeenCalled();
});

it('refuses downloaded assets with incorrect hashes', async () => {
  const dir = await directory();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('tampered download')));
  await expect(fetchWithHashCheck('https://example.test/model', join(dir, 'model'), hash('expected'))).rejects.toThrow('hash mismatch');
});
