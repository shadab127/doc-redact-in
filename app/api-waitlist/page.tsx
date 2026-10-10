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
        DocRedact.in is planning a browser-side integration that would let users
        redact documents before sending them to your application. It is not
        available yet. Join the waitlist to discuss your needs and receive updates.
      </p>

      <p>
        The intended approach keeps OCR, detection and redaction on the user&apos;s
        device. We are not offering server-side document processing. Integration
        details, pricing and release timing are not finalized.
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
