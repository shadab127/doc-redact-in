/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';
import {
  isValidEmail,
  validateWaitlist,
  validateContact,
  WAITLIST_USE_CASES,
} from '@/src/ui/forms';

describe('isValidEmail', () => {
  it.each(['a@b.co', 'foo.bar@example.com', 'shadab+test@example.co.in'])(
    'accepts %s',
    (v) => {
      expect(isValidEmail(v)).toBe(true);
    }
  );

  it.each(['', ' ', 'noatsign', 'a@', '@b.co', 'a@b', 'a@b.c'])(
    'rejects %s',
    (v) => {
      expect(isValidEmail(v)).toBe(false);
    }
  );

  it('trims whitespace before validating', () => {
    expect(isValidEmail('  a@b.co  ')).toBe(true);
  });
});

describe('validateWaitlist', () => {
  it('accepts a fully populated valid submission', () => {
    expect(
      validateWaitlist({
        email: 'a@b.co',
        company: 'Acme',
        useCase: WAITLIST_USE_CASES[0],
      })
    ).toBeNull();
  });

  it('rejects missing email', () => {
    expect(
      validateWaitlist({ company: 'Acme', useCase: WAITLIST_USE_CASES[0] })
    ).toMatch(/email/i);
  });

  it('rejects short company name', () => {
    expect(
      validateWaitlist({ email: 'a@b.co', company: 'A', useCase: WAITLIST_USE_CASES[0] })
    ).toMatch(/company/i);
  });

  it('rejects missing use case', () => {
    expect(
      validateWaitlist({ email: 'a@b.co', company: 'Acme' })
    ).toMatch(/use case/i);
  });
});

describe('validateContact', () => {
  it('accepts a valid contact payload', () => {
    expect(
      validateContact({ email: 'a@b.co', message: 'Hello, this is a note.' })
    ).toBeNull();
  });

  it('rejects messages shorter than 10 chars', () => {
    expect(validateContact({ email: 'a@b.co', message: 'hi' })).toMatch(/10 character/);
  });

  it('rejects messages longer than 5000 chars', () => {
    expect(
      validateContact({ email: 'a@b.co', message: 'a'.repeat(5001) })
    ).toMatch(/too long/i);
  });
});
