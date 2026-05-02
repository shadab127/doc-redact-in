/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { isBrowserCapable } from '@/src/ui/UnsupportedBrowserGuard';

const g = globalThis as {
  window?: unknown;
  document?: unknown;
  WebAssembly?: unknown;
  URL?: unknown;
  Blob?: unknown;
};

function shimDom(capable: boolean) {
  g.window = {};
  g.document = {
    createElement: (tag: string) => {
      if (tag !== 'canvas') return {};
      return capable ? { getContext: () => ({}) } : { getContext: undefined };
    },
  };
  g.URL = { createObjectURL: () => 'blob:stub' };
  g.Blob = class {};
  g.WebAssembly = {};
}

afterEach(() => {
  delete g.window;
  delete g.document;
  delete g.URL;
  delete g.Blob;
  delete g.WebAssembly;
});

describe('isBrowserCapable', () => {
  it('returns true in server-side rendering (no window)', () => {
    delete g.window;
    expect(isBrowserCapable()).toBe(true);
  });

  it('returns true when a browser has WebAssembly + canvas + Blob + URL', () => {
    shimDom(true);
    expect(isBrowserCapable()).toBe(true);
  });

  it('returns false when WebAssembly is missing', () => {
    shimDom(true);
    delete g.WebAssembly;
    expect(isBrowserCapable()).toBe(false);
  });

  it('returns false when canvas.getContext is missing', () => {
    shimDom(false);
    expect(isBrowserCapable()).toBe(false);
  });

  it('returns false when Blob is missing', () => {
    shimDom(true);
    delete g.Blob;
    expect(isBrowserCapable()).toBe(false);
  });
});
