/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
'use client';

import { useState } from 'react';
import { FORM_ENDPOINTS, validateContact } from './forms';

type Status = 'idle' | 'submitting' | 'sent' | 'error';

export function ContactForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateContact({ email, message });
    if (validationError) {
      setErr(validationError);
      return;
    }
    setErr(null);
    setStatus('submitting');
    try {
      const res = await fetch(FORM_ENDPOINTS.contact, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, message }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus('sent');
    } catch (error) {
      setErr(
        error instanceof Error
          ? `Could not send: ${error.message}. Please email hello@docredact.in directly.`
          : 'Could not send. Please email hello@docredact.in directly.'
      );
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div role="status" style={{ padding: 16, background: '#1b2033', borderRadius: 8 }}>
        Thanks — message received. We&apos;ll get back to you within a week.
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13 }}>Your email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'submitting'}
          style={inputStyle}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13 }}>Message</span>
        <textarea
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={status === 'submitting'}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </label>
      {err && (
        <div role="alert" style={{ color: '#ff9d9d', fontSize: 13 }}>
          {err}
        </div>
      )}
      <button type="submit" disabled={status === 'submitting'} style={btnStyle}>
        {status === 'submitting' ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  background: '#15171d',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--fg)',
  fontSize: 14,
  fontFamily: 'inherit',
};

const btnStyle: React.CSSProperties = {
  padding: '12px 16px',
  background: 'var(--accent)',
  color: '#000',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
