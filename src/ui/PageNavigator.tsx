/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
'use client';

export interface PageNavigatorProps {
  pageIndex: number;
  totalPages: number;
  onPageChange: (next: number) => void;
}

export function PageNavigator({ pageIndex, totalPages, onPageChange }: PageNavigatorProps) {
  if (totalPages <= 1) return null;

  const atFirst = pageIndex <= 0;
  const atLast = pageIndex >= totalPages - 1;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '12px 0',
        fontSize: 13,
      }}
    >
      <button
        type="button"
        onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
        disabled={atFirst}
        style={btnStyle(atFirst)}
        aria-label="Previous page"
        data-testid="page-nav-prev"
      >
        ←
      </button>
      <span aria-live="polite" data-testid="page-nav-label">
        Page {pageIndex + 1} of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages - 1, pageIndex + 1))}
        disabled={atLast}
        style={btnStyle(atLast)}
        aria-label="Next page"
        data-testid="page-nav-next"
      >
        →
      </button>
    </div>
  );
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 36,
    height: 32,
    background: disabled ? '#15171d' : 'var(--accent)',
    color: disabled ? 'var(--muted)' : '#000',
    border: '1px solid var(--border)',
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 14,
    fontWeight: 600,
  };
}
