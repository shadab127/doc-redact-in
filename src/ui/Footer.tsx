/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import Link from 'next/link';

export function Footer() {
  return (
    <footer
      style={{
        maxWidth: 720,
        margin: '48px auto 24px',
        padding: '24px',
        borderTop: '1px solid var(--border)',
        fontSize: 13,
        color: 'var(--muted)',
        lineHeight: 1.8,
      }}
    >
      <div>
        <Link href="/privacy">Privacy</Link> ·{' '}
        <Link href="/terms">Terms</Link> ·{' '}
        <Link href="/contact">Contact</Link> ·{' '}
        <a
          href="https://github.com/shadab127/doc-redact-in"
          rel="noopener noreferrer"
          target="_blank"
        >
          Source (AGPL-3.0)
        </a>
      </div>
      <div style={{ marginTop: 10, fontSize: 12 }}>
        Nothing you drop here leaves your device. Verify in DevTools → Network.
      </div>
    </footer>
  );
}
