/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import type { Metadata } from 'next';
import { TextPage } from '@/src/ui/TextPage';

export const metadata: Metadata = {
  title: 'Privacy Policy — DocRedact.in',
  description:
    'We do not see your documents. Everything runs in your browser. Here is exactly what we collect, store, and forward — in plain English.',
};

export default function PrivacyPage() {
  return (
    <TextPage title="Privacy policy" lastUpdated="2026-05-02">
      <p>
        <strong>The short version: we do not see your documents.</strong>
      </p>
      <p>
        DocRedact.in processes your file entirely in your browser tab. It never
        leaves your device. We have no servers that touch your document, no
        database that stores it, no API that analyzes it. If you disconnect from
        the internet after loading this page, the tool still works — because
        everything runs locally.
      </p>

      <h2>What we do collect</h2>
      <ul>
        <li>
          <strong>Page view counts</strong>, via Cloudflare Web Analytics. This
          tells us which pages are visited, from which country (state-level at
          most), and from which referring site. No cookies. No IP addresses
          stored. No fingerprints. No ability to identify you.
        </li>
        <li>
          <strong>If you use the B2B API waitlist form</strong>: your email,
          company name, and use-case selection. Stored in Cloudflare Workers KV.
          We use it only to contact you about the API.
        </li>
        <li>
          <strong>If you use the contact form</strong>: your email and message.
          Forwarded to our inbox. We keep it as long as needed to respond to you.
        </li>
      </ul>

      <h2>What we never collect</h2>
      <ul>
        <li>Your documents, or any part of them.</li>
        <li>OCR text extracted from your documents.</li>
        <li>Detection coordinates, filenames, or file sizes of what you redact.</li>
        <li>Cookies. Tracking pixels. Third-party trackers. Session replay.</li>
      </ul>

      <h2>Verify it yourself</h2>
      <p>
        Our full code is public on GitHub under AGPL-3.0:{' '}
        <a
          href="https://github.com/shadabkhan/doc-redact-in"
          rel="noopener noreferrer"
          target="_blank"
        >
          github.com/shadabkhan/doc-redact-in
        </a>
        . The &ldquo;no network calls during redaction&rdquo; property is tested in
        CI. Open your browser&apos;s DevTools, go to the Network tab, and watch —
        you will see no requests leave your machine while you redact.
      </p>

      <h2>Your rights</h2>
      <p>
        You can request deletion of any contact or waitlist data at any time by
        emailing{' '}
        <a href="mailto:hello@docredact.in">hello@docredact.in</a>. Because we
        never receive your documents, there is no document data to request
        deletion of — there was nothing to delete to begin with.
      </p>

      <h2>DPDP Act framing</h2>
      <p>
        DocRedact.in is not a Data Fiduciary for the documents you redact,
        because your document contents do not traverse our infrastructure at any
        point. We are a Data Fiduciary for the small amount of contact
        information you may voluntarily submit via the waitlist or contact
        forms, and we handle that information as described above.
      </p>

      <p style={{ marginTop: 32, fontSize: 13, color: 'var(--muted)' }}>
        Changes to this policy are announced in the GitHub repository commit
        history. The &ldquo;last updated&rdquo; date at the top of this page
        reflects the latest version.
      </p>
    </TextPage>
  );
}
