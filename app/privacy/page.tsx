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
          <strong>Basic request metadata</strong>: Cloudflare serves this site
          and handles IP addresses and browser request headers. We do not run
          analytics, advertising trackers or third-party scripts in the app.
          Waitlist requests use a short-lived IP-based rate limit to prevent
          abuse; IP addresses are not saved with waitlist entries.
        </li>
        <li>
          <strong>If you use the B2B API waitlist form</strong>: your email,
          company name, and use-case selection. Stored in Cloudflare Workers KV
          with automatic expiration after 90 days. We use it only to contact
          you about the API. If email notifications are configured, Resend
          delivers a generic signup notice to our inbox; that notice does not
          include your email, company or use case.
        </li>
        <li>
          <strong>If you email us</strong>: your email and message arrive in
          our inbox via Cloudflare Email Routing. We keep correspondence only
          as long as needed to respond. Do not attach identity documents.
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
        Network and watch: you may see software downloads, but no request
        carrying your document. The tests cover specific fixtures
        and are regression checks, not a guarantee about every possible input.
      </p>

      <h2>Document memory in your tab</h2>
      <p>
        Navigation between automatic and manual redaction keeps the original
        document in this tab&apos;s memory so you can continue editing. Start
        over clears both modes and pending transfers and releases the document
        canvases. Reloading or closing the tab also ends the editing session.
        JavaScript cannot guarantee forensic erasure from browser or operating
        system memory. Downloaded PDFs remain on your device until you delete them.
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
        Email correspondence and waitlist submissions are separate from document
        redaction. Only the information you explicitly submit is sent to our infrastructure.
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
