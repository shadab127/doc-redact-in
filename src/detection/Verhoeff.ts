/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */

// Dihedral group D5 multiplication table.
const D: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
] as const;

// Permutation table.
const P: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
] as const;

function digitsOf(s: string): number[] | null {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return null;
    out.push(c - 48);
  }
  return out;
}

export function isValidVerhoeff(input: string): boolean {
  if (!input) return false;
  const digits = digitsOf(input);
  if (!digits || digits.length === 0) return false;
  let c = 0;
  for (let i = 0; i < digits.length; i++) {
    const digit = digits[digits.length - 1 - i]!;
    const pRow = P[i % 8]!;
    c = D[c]![pRow[digit]!]!;
  }
  return c === 0;
}

export function verhoeffCheckDigit(inputWithoutCheck: string): number {
  const digits = digitsOf(inputWithoutCheck);
  if (!digits) throw new Error('non-digit input');
  let c = 0;
  for (let i = 0; i < digits.length; i++) {
    const digit = digits[digits.length - 1 - i]!;
    const pRow = P[(i + 1) % 8]!;
    c = D[c]![pRow[digit]!]!;
  }
  for (let d = 0; d < 10; d++) {
    if (D[c]![d]! === 0) return d;
  }
  throw new Error('unreachable');
}
