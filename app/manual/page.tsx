/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

const ManualRedactApp = dynamic(
  () => import('@/src/ui/manual/ManualRedactApp').then((m) => m.ManualRedactApp),
  { ssr: false }
);

export const metadata: Metadata = {
  title: 'Manual redact — DocRedact.in',
  description:
    'Draw black-rectangle redactions on any image or PDF, in your browser. Nothing leaves your device.',
  robots: { index: false, follow: false },
};

export default function ManualRedactPage() {
  return (
    <main className="hero-main">
      <div className="hero-grid">
        <div className="hero-col" style={{ gridColumn: '1 / -1' }}>
          <span className="hero-badge">
            <span aria-hidden="true">🔒</span> 100% in your browser · Manual mode
          </span>
          <h1 className="hero-title">
            Manual <span className="hero-title-accent">redact</span>.
          </h1>
          <p className="hero-sub">
            Draw black rectangles on any PDF or image. Auto-detect not used here — you
            decide every mask. Output is flattened to an image-only PDF.
          </p>
          <div className="hero-card">
            <ManualRedactApp />
          </div>
          <p className="trust-line">
            Nothing you drop here leaves your device. Verify in DevTools &rarr; Network.
          </p>
        </div>
      </div>
    </main>
  );
}
