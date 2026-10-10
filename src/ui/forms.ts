/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */

export const WAITLIST_LIMITS = { email: 254, company: 200, bodyBytes: 4096 } as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export const WAITLIST_USE_CASES = [
  'HR / payroll',
  'Fintech KYC',
  'Prop-tech / tenancy',
  'Insurance',
  'Healthcare',
  'Government / public sector',
  'Other',
] as const;

export type WaitlistUseCase = (typeof WAITLIST_USE_CASES)[number];

export interface WaitlistPayload {
  email: string;
  company: string;
  useCase: WaitlistUseCase;
}

export function validateWaitlist(v: Partial<WaitlistPayload>): string | null {
  if (!v.email || v.email.trim().length > WAITLIST_LIMITS.email || !isValidEmail(v.email)) return 'Please enter a valid email.';
  if (!v.company || v.company.trim().length < 2 || v.company.trim().length > WAITLIST_LIMITS.company)
    return 'Please enter a company name (2–200 characters).';
  if (!v.useCase || !WAITLIST_USE_CASES.includes(v.useCase)) return 'Please pick a use case.';
  return null;
}

export const FORM_ENDPOINTS = {
  waitlist: '/api/waitlist',
} as const;
