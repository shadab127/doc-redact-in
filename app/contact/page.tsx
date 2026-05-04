/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import type { Metadata } from 'next';
import { TextPage } from '@/src/ui/TextPage';
import { ContactForm } from '@/src/ui/ContactForm';

export const metadata: Metadata = {
  title: 'Contact — DocRedact.in',
  description:
    'Feedback, bug reports, questions — reach the maintainer via GitHub Issues or email.',
};

export default function ContactPage() {
  return (
    <TextPage title="Contact">
      <p>
        For bug reports and feature requests, the fastest channel is{' '}
        <a
          href="https://github.com/shadab127/doc-redact-in/issues"
          rel="noopener noreferrer"
          target="_blank"
        >
          GitHub Issues
        </a>
        . Public, structured, searchable. Preferred if you are a technical
        user.
      </p>
      <p>
        For everything else — press questions, business inquiries, private
        feedback, legal requests — use the form below or email{' '}
        <a href="mailto:hello@docredact.in">hello@docredact.in</a>. Messages go
        straight to a personal inbox via Cloudflare Email Routing.
      </p>
      <div style={{ marginTop: 24 }}>
        <ContactForm />
      </div>
      <p style={{ marginTop: 32, fontSize: 13, color: 'var(--muted)' }}>
        No formal SLA. Best-effort response within 3–7 days. Critical bugs are
        prioritized.
      </p>
    </TextPage>
  );
}
