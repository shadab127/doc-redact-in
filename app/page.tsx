/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { DetectionChips } from '@/src/ui/DetectionChips';

const RedactorApp = dynamic(
  () => import('@/src/ui/RedactorApp').then((m) => m.RedactorApp),
  { ssr: false }
);

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
      <div className="hero-grid">
        <div>
          <h1 style={{ fontSize: 36, marginBottom: 8, marginTop: 0 }}>DocRedact.in</h1>
          <p style={{ color: 'var(--muted)', marginTop: 0, marginBottom: 20, fontSize: 16 }}>
            Your browser redacts it. Nothing leaves your device.
          </p>
          <RedactorApp sampleUrl="/samples/sample-aadhaar.svg" />
          <p className="trust-line">
            Nothing you drop here leaves your device. Verify in DevTools &rarr; Network.
          </p>
        </div>

        <div className="hero-illustration">
          <Image
            src="/hero-before-after.svg"
            alt="Before and after: an ID card with Aadhaar number and face replaced by black redaction bars"
            width={320}
            height={380}
            priority
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        </div>
      </div>

      <DetectionChips />
    </main>
  );
}
