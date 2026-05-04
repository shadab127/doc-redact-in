/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import dynamic from 'next/dynamic';
import { DetectionChips } from '@/src/ui/DetectionChips';
import { HeroIllustration } from '@/src/ui/HeroIllustration';

const RedactorApp = dynamic(
  () => import('@/src/ui/RedactorApp').then((m) => m.RedactorApp),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="hero-main">
      <div className="hero-grid">
        <div id="redactor" className="hero-col">
          <span className="hero-badge">
            <span aria-hidden="true">🔒</span> 100% in your browser · Open source
          </span>
          <h1 className="hero-title">
            Redact <span className="hero-title-accent">Identity</span>.
            <br />
            Right in your browser.
          </h1>
          <p className="hero-sub">
            Your browser auto-detects Aadhaar, PAN, passport MRZ, UIDAI QR, and faces —
            then masks them. Nothing leaves your device.
          </p>
          <div className="hero-card">
            <RedactorApp sampleUrl="/samples/sample-aadhaar.svg" />
          </div>
          <p className="trust-line">
            Nothing you drop here leaves your device. Verify in DevTools &rarr; Network.
          </p>
        </div>

        <div className="hero-illustration">
          <HeroIllustration />
        </div>
      </div>

      <DetectionChips />
    </main>
  );
}
