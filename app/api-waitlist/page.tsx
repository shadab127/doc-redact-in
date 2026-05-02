/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import type { Metadata } from 'next';
import { TextPage } from '@/src/ui/TextPage';
import { WaitlistForm } from '@/src/ui/WaitlistForm';

export const metadata: Metadata = {
  title: 'B2B API waitlist — DocRedact.in',
  description:
    'Integrating Indian ID document redaction into your HR, fintech KYC, or insurance pipeline? Join the API waitlist.',
};

export default function ApiWaitlistPage() {
  return (
    <TextPage title="B2B API waitlist">
      <p>
        Building HR tech, KYC, tenancy-check, or document intake software?
        DocRedact.in offers the same detection pipeline as the consumer tool,
        exposed as a server-side API with per-redaction billing. Drop your
        email and the team will reach out when the private beta opens.
      </p>

      <p>
        The API runs the identical Aadhaar + Verhoeff + PAN + MRZ + face + QR
        detection, zero-retains your document bytes, and returns a flattened
        image-only PDF. Volume-friendly pricing, India-region deployment, and
        a VPC-peering / on-premise option are on the roadmap.
      </p>

      <div style={{ marginTop: 24 }}>
        <WaitlistForm />
      </div>

      <p style={{ marginTop: 32, fontSize: 13, color: 'var(--muted)' }}>
        Prefer to email? <a href="mailto:hello@docredact.in">hello@docredact.in</a>.
      </p>
    </TextPage>
  );
}
