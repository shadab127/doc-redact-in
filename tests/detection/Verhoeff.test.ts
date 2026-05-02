/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';
import { isValidVerhoeff, verhoeffCheckDigit } from '@/src/detection/Verhoeff';

function makeValid(body: string): string {
  return body + String(verhoeffCheckDigit(body));
}

describe('Verhoeff — fixed-body vectors', () => {
  // Bodies with check digits derived by the implementation itself; these anchor
  // behaviour against regressions in the Verhoeff tables/folding loop.
  const bodies = ['236', '75872', '847364309', '1234567890', '14285714285714'];

  it.each(bodies)('body %s yields a self-consistent valid number', (body) => {
    const full = makeValid(body);
    expect(isValidVerhoeff(full)).toBe(true);
  });

  it.each(bodies)('last-digit perturbation of valid(%s) is rejected', (body) => {
    const full = makeValid(body);
    const last = Number(full[full.length - 1]);
    const tampered = full.slice(0, -1) + String((last + 1) % 10);
    expect(isValidVerhoeff(tampered)).toBe(false);
  });
});

describe('Verhoeff — generated 200-vector battery (Validation Gate #2)', () => {
  // Generate 200 deterministic 11-digit bodies, compute their check digits,
  // and verify the algorithm's three defining properties hold across all 200:
  //   1. The generated 12-digit number is accepted.
  //   2. Flipping any single digit is rejected (single-error detection).
  //   3. Swapping any two distinct adjacent digits is rejected (adjacent-transposition detection).
  // Verhoeff's design guarantees (2) and (3); a correct implementation must reproduce them.
  function seededBody(seed: number): string {
    let x = (seed * 2654435761) >>> 0;
    let s = '';
    for (let i = 0; i < 11; i++) {
      x = (x * 1103515245 + 12345) >>> 0;
      s += String((x >>> 16) % 10);
    }
    return s;
  }

  const vectors: string[] = [];
  for (let i = 1; i <= 200; i++) vectors.push(makeValid(seededBody(i)));

  it('all 200 generated vectors validate', () => {
    const failures = vectors.filter((v) => !isValidVerhoeff(v));
    expect(failures).toEqual([]);
  });

  it('single-digit substitution detected in all 200 vectors', () => {
    for (const v of vectors) {
      for (let pos = 0; pos < v.length; pos++) {
        const orig = Number(v[pos]);
        for (let d = 0; d < 10; d++) {
          if (d === orig) continue;
          const tampered = v.slice(0, pos) + String(d) + v.slice(pos + 1);
          expect(isValidVerhoeff(tampered)).toBe(false);
        }
      }
    }
  });

  it('adjacent-transposition detected for all distinct-digit adjacent pairs', () => {
    for (const v of vectors) {
      for (let i = 0; i < v.length - 1; i++) {
        if (v[i] === v[i + 1]) continue;
        const swapped =
          v.slice(0, i) + v[i + 1] + v[i] + v.slice(i + 2);
        expect(isValidVerhoeff(swapped)).toBe(false);
      }
    }
  });
});

describe('Verhoeff — input validation', () => {
  it('rejects empty string', () => {
    expect(isValidVerhoeff('')).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(isValidVerhoeff('1234a')).toBe(false);
    expect(isValidVerhoeff('12 34')).toBe(false);
  });

  it('verhoeffCheckDigit throws on non-digit input', () => {
    expect(() => verhoeffCheckDigit('abc')).toThrow();
  });

  it('verhoeffCheckDigit is the inverse of isValidVerhoeff', () => {
    for (const body of ['0', '1', '12345678901', '999999999999']) {
      expect(isValidVerhoeff(makeValid(body))).toBe(true);
    }
  });
});
