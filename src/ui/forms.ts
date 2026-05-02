/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */

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

export interface ContactPayload {
  email: string;
  message: string;
}

export function validateWaitlist(v: Partial<WaitlistPayload>): string | null {
  if (!v.email || !isValidEmail(v.email)) return 'Please enter a valid email.';
  if (!v.company || v.company.trim().length < 2)
    return 'Please enter a company name.';
  if (!v.useCase) return 'Please pick a use case.';
  return null;
}

export function validateContact(v: Partial<ContactPayload>): string | null {
  if (!v.email || !isValidEmail(v.email)) return 'Please enter a valid email.';
  if (!v.message || v.message.trim().length < 10)
    return 'Please write at least 10 characters.';
  if (v.message.length > 5000) return 'Message is too long (5000 character max).';
  return null;
}

// Form endpoints live at these paths; Cloudflare Pages routes /api/* to the
// corresponding Cloudflare Worker. Pre-launch these will 404 — forms catch
// that and show the "we'll wire this up at launch" fallback state.
export const FORM_ENDPOINTS = {
  waitlist: '/api/waitlist',
  contact: '/api/contact',
} as const;
