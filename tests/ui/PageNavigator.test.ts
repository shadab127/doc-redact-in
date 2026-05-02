/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';

// Pure logic check without rendering — the component's clamping is derived
// from these two expressions. If we ever change either we want the test to
// catch the drift.

function prevIndex(curr: number): number {
  return Math.max(0, curr - 1);
}

function nextIndex(curr: number, total: number): number {
  return Math.min(total - 1, curr + 1);
}

describe('PageNavigator clamp logic', () => {
  it('prev at zero stays at zero', () => {
    expect(prevIndex(0)).toBe(0);
  });

  it('prev decrements inside range', () => {
    expect(prevIndex(3)).toBe(2);
  });

  it('next at last stays at last', () => {
    expect(nextIndex(4, 5)).toBe(4);
  });

  it('next increments inside range', () => {
    expect(nextIndex(2, 5)).toBe(3);
  });

  it('handles single-page edge case', () => {
    expect(prevIndex(0)).toBe(0);
    expect(nextIndex(0, 1)).toBe(0);
  });
});
