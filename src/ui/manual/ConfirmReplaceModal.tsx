/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
'use client';

import { useCallback, useEffect, useRef } from 'react';

export interface ConfirmReplaceModalProps {
  open: boolean;
  onKeep: () => void;
  onReplace: () => void;
}

/**
 * Shown when a second handoff arrives at /manual while the user has dirty
 * edits. "Keep" is the safe/default action — Esc, click-outside, and the
 * primary button all map to it. "Replace" is destructive, styled as the
 * secondary action.
 */
export function ConfirmReplaceModal({
  open,
  onKeep,
  onReplace,
}: ConfirmReplaceModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const keepBtnRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Focus trap: grab focus on open, restore on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement | null) ?? null;
    keepBtnRef.current?.focus();
    return () => {
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  // Esc to keep edits. Tab-cycle constrained inside the dialog.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!open) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onKeep();
        return;
      }
      if (e.key === 'Tab') {
        const container = dialogRef.current;
        if (!container) return;
        const focusables = container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onKeep, open]
  );

  if (!open) return null;

  return (
    <div
      data-testid="confirm-replace-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onKeep();
      }}
      onKeyDown={onKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-replace-title"
        aria-describedby="confirm-replace-desc"
        data-testid="confirm-replace-modal"
        style={{
          background: 'var(--surface, #1a1c22)',
          border: '1px solid var(--border-strong, #3f3f46)',
          borderRadius: 12,
          padding: 20,
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 20px 50px -12px rgba(0,0,0,0.6)',
          color: 'var(--fg, #fff)',
        }}
      >
        <h2
          id="confirm-replace-title"
          style={{ margin: '0 0 10px 0', fontSize: 17, fontWeight: 700 }}
        >
          Replace your manual edits?
        </h2>
        <p
          id="confirm-replace-desc"
          style={{
            margin: '0 0 18px 0',
            fontSize: 14,
            color: 'var(--muted, #9a9aa2)',
            lineHeight: 1.45,
          }}
        >
          You have unsaved boxes in manual mode. Opening a new document here will
          discard them and load the latest auto-detected boxes instead.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            ref={keepBtnRef}
            type="button"
            data-testid="confirm-replace-keep"
            onClick={onKeep}
            style={{
              padding: '9px 16px',
              background: 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow:
                '0 8px 20px -10px rgba(124, 58, 237, 0.7), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            Keep my edits
          </button>
          <button
            type="button"
            data-testid="confirm-replace-replace"
            onClick={onReplace}
            style={{
              padding: '9px 16px',
              background: 'transparent',
              color: 'var(--fg, #fff)',
              border: '1px solid var(--border-strong, #3f3f46)',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Replace with new detection
          </button>
        </div>
      </div>
    </div>
  );
}
