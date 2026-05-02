/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

export function TextPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated?: string;
  children: ReactNode;
}) {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
      <Link href="/" style={{ fontSize: 13 }}>
        ← DocRedact.in
      </Link>
      <h1 style={{ fontSize: 28, margin: '24px 0 8px' }}>{title}</h1>
      {lastUpdated && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 24 }}>
          Last updated {lastUpdated}.
        </div>
      )}
      <article style={{ lineHeight: 1.65, fontSize: 16 }}>{children}</article>
    </main>
  );
}
