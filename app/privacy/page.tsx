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
    <TextPage title="Privacy policy" lastUpdated="2026-10-10">
      <p>
        <strong>The short version: we do not see your documents.</strong>
      </p>
      <p>
        DocRedact.in runs OCR, detection and export entirely in your browser tab.
        Your document is not uploaded to our infrastructure. First use downloads
        software and model assets from this site. Offline use depends on those
        assets already being loaded and available in your browser cache; loading
        the page alone does not guarantee it.
      </p>

      <h2>What we do collect</h2>
      <ul>
        <li>
          <strong>Page view counts</strong>, via Cloudflare Web Analytics. This
          tells us which pages are visited, approximate countries and referring
          sites. Its script and collection endpoint are hosted by Cloudflare,
          so analytics makes external requests. We do not send filenames, OCR
          text, QR contents or document pixels to analytics. See{' '}
          <a href="https://developers.cloudflare.com/web-analytics/" target="_blank" rel="noopener noreferrer">
            Cloudflare&apos;s Web Analytics documentation
          </a>{' '}
          for its current data practices.
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
        <li>Advertising trackers or session replay.</li>
      </ul>

      <h2>Verify it yourself</h2>
      <p>
        Our full code is public on GitHub under AGPL-3.0:{' '}
        <a
          href="https://github.com/shadab127/doc-redact-in"
          rel="noopener noreferrer"
          target="_blank"
        >
          github.com/shadab127/doc-redact-in
        </a>
        . Browser tests check network requests during detection and export,
        including same-origin requests and manual redaction. Open DevTools →
        Network and watch: you may see software downloads and analytics requests,
        but no request carrying your document. The tests cover specific fixtures
        and are regression checks, not a guarantee about every possible input.
      </p>

      <h2>Your rights</h2>
      <p>
        You can request deletion of any contact or waitlist data at any time by
        emailing{' '}
        <a href="mailto:hello@docredact.in">hello@docredact.in</a>. Because we
        never receive your documents, there is no document data to request
        deletion of — there was nothing to delete to begin with.
      </p>

      <h2>Contact information</h2>
      <p>
        Contact and waitlist forms are separate from document redaction. Only
        the information you enter in those forms is sent to our infrastructure.
        A future business integration is planned to keep document processing on
        the user&apos;s device; no server-side document API is currently offered.
      </p>

      <p style={{ marginTop: 32, fontSize: 13, color: 'var(--muted)' }}>
        Changes to this policy are announced in the GitHub repository commit
        history. The &ldquo;last updated&rdquo; date at the top of this page
        reflects the latest version.
      </p>
    </TextPage>
  );
}
