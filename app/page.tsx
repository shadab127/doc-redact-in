/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import dynamic from 'next/dynamic';

const RedactorApp = dynamic(
  () => import('@/src/ui/RedactorApp').then((m) => m.RedactorApp),
  { ssr: false }
);

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>DocRedact.in</h1>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>
        Your browser redacts it. Nothing leaves your device.
      </p>
      <RedactorApp />
    </main>
  );
}
