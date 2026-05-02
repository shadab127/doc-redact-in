/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
'use client';

import { useState } from 'react';
import {
  FORM_ENDPOINTS,
  validateWaitlist,
  WAITLIST_USE_CASES,
  type WaitlistUseCase,
} from './forms';

type Status = 'idle' | 'submitting' | 'sent' | 'error';

export function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [useCase, setUseCase] = useState<WaitlistUseCase>(WAITLIST_USE_CASES[0]);
  const [status, setStatus] = useState<Status>('idle');
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateWaitlist({ email, company, useCase });
    if (validationError) {
      setErr(validationError);
      return;
    }
    setErr(null);
    setStatus('submitting');
    try {
      const res = await fetch(FORM_ENDPOINTS.waitlist, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, company, useCase }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus('sent');
    } catch (error) {
      setErr(
        error instanceof Error
          ? `Could not submit: ${error.message}. Email hello@docredact.in directly and we will add you.`
          : 'Could not submit. Email hello@docredact.in directly.'
      );
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div role="status" style={{ padding: 16, background: '#1b2033', borderRadius: 8 }}>
        Thanks — you&apos;re on the list. We&apos;ll email you when the API beta opens.
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13 }}>Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'submitting'}
          style={formInputStyle}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13 }}>Company</span>
        <input
          type="text"
          required
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          disabled={status === 'submitting'}
          style={formInputStyle}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13 }}>Use case</span>
        <select
          value={useCase}
          onChange={(e) => setUseCase(e.target.value as WaitlistUseCase)}
          disabled={status === 'submitting'}
          style={formInputStyle}
        >
          {WAITLIST_USE_CASES.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </label>
      {err && (
        <div role="alert" style={{ color: '#ff9d9d', fontSize: 13 }}>
          {err}
        </div>
      )}
      <button type="submit" disabled={status === 'submitting'} style={primaryButtonStyle}>
        {status === 'submitting' ? 'Submitting…' : 'Request API access'}
      </button>
    </form>
  );
}

const formInputStyle: React.CSSProperties = {
  padding: '10px 12px',
  background: '#15171d',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--fg)',
  fontSize: 14,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '12px 16px',
  background: 'var(--accent)',
  color: '#000',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
