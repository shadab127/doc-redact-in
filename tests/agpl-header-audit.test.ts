/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..');
const CHECKED_DIRS = ['app', 'src', 'tests', 'workers', 'scripts'];
const IGNORED_FILES = new Set(['next-env.d.ts']);
const CHECKED_EXTS = new Set(['.ts', '.tsx', '.mts', '.mjs']);
const EXCLUDED_SEGMENTS = new Set(['node_modules', '.next', 'out', 'coverage', 'dist']);

const HEADER_MARKER = 'GNU Affero General Public License';

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (EXCLUDED_SEGMENTS.has(name)) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (s.isFile()) out.push(p);
  }
  return out;
}

describe('AGPL header audit', () => {
  it('every source file under app/src/tests/workers/scripts has the AGPL header', () => {
    const offenders: string[] = [];
    for (const d of CHECKED_DIRS) {
      const root = join(REPO_ROOT, d);
      for (const file of walk(root)) {
        const base = file.split('/').pop()!;
        if (IGNORED_FILES.has(base)) continue;
        const ext = file.slice(file.lastIndexOf('.'));
        if (!CHECKED_EXTS.has(ext)) continue;
        const head = readFileSync(file, 'utf8').slice(0, 1024);
        if (!head.includes(HEADER_MARKER)) {
          offenders.push(file.replace(REPO_ROOT + '/', ''));
        }
      }
    }
    expect(offenders, `AGPL header missing from:\n${offenders.join('\n')}`).toEqual([]);
  });
});
