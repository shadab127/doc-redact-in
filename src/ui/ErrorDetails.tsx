/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
'use client';

import { useState } from 'react';

export interface RawError {
  name: string;
  message: string;
  stack?: string;
}

export function captureRawError(e: unknown): RawError {
  if (e instanceof Error) {
    return { name: e.name, message: e.message, stack: e.stack };
  }
  return { name: 'NonError', message: String(e) };
}

function formatRaw(r: RawError): string {
  const head = `${r.name}: ${r.message}`;
  return r.stack ? `${head}\n${r.stack}` : head;
}

export interface ErrorDetailsProps {
  raw: RawError;
}

export function ErrorDetails({ raw }: ErrorDetailsProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatRaw(raw));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (no user gesture, permissions). Swallow —
      // user can still select and copy the <pre> manually.
    }
  };

  return (
    <details className="error-details" data-testid="error-details">
      <summary>Show technical details</summary>
      <div className="error-details-body">
        <button
          type="button"
          onClick={onCopy}
          className="error-details-copy"
          data-testid="error-details-copy"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <pre data-testid="error-details-raw">{formatRaw(raw)}</pre>
      </div>
    </details>
  );
}
