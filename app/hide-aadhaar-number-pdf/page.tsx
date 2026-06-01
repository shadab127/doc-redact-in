/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { HIDE_AADHAAR_PDF_FAQ } from '@/src/content/faq';

const RedactorApp = dynamic(
  () => import('@/src/ui/RedactorApp').then((m) => m.RedactorApp),
  { ssr: false }
);

export const metadata: Metadata = {
  title: 'Hide Aadhaar Number in a PDF — Free, Browser-Only, Open Source | DocRedact.in',
  description:
    'Permanently remove your Aadhaar number from a PDF — not just cover it. Re-rendered as an image-only PDF in your browser so nothing can be text-extracted. Free, open source (AGPL-3.0).',
  alternates: {
    canonical: '/hide-aadhaar-number-pdf',
    types: {
      'application/ld+json': '/schema/hide-aadhaar-number-pdf.json',
    },
  },
  openGraph: {
    title: 'Hide Aadhaar Number in a PDF — Browser-Only, Open Source',
    description:
      'Your browser strips the text layer and rebuilds an image-only PDF, so the masked Aadhaar number is gone, not merely hidden.',
    type: 'article',
  },
};

export default function HideAadhaarNumberPdfPage() {
  const FAQ = HIDE_AADHAAR_PDF_FAQ;
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
      <Link href="/" style={{ fontSize: 13 }}>
        ← DocRedact.in
      </Link>

      <h1 style={{ fontSize: 32, margin: '24px 0 8px' }}>
        Hide your Aadhaar number in a PDF
      </h1>
      <p style={{ fontSize: 18, color: 'var(--muted)', marginTop: 0 }}>
        Not just a black box over the text — your browser rebuilds the PDF as an
        image so the number is actually gone. Nothing uploaded. Free forever.
      </p>

      <RedactorApp />

      <section style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 22 }}>
          Why a black box in a PDF editor is not enough
        </h2>
        <p>
          This is the single most important thing to understand about redacting a
          PDF, and it traps people constantly. When you open a PDF in a normal
          editor and draw a black rectangle over your Aadhaar number, you have
          added a black shape on top of the page — but the original digits are
          still sitting underneath, in the document&apos;s text layer. Anyone who
          receives that PDF can select the area and copy-paste the number out, or
          run a command-line tool like <code>pdftotext</code>, or simply delete
          the black box in their own editor. The number was never removed; it was
          covered. For an Aadhaar number, that is a false sense of safety that is
          arguably worse than doing nothing, because you believe you are protected
          when you are not.
        </p>
        <p>
          DocRedact.in does it differently. It renders every page of your PDF to an
          image, draws the black rectangles onto that image, and then builds a
          brand-new PDF in which each page is just that flattened image. The
          rebuilt PDF has no text layer at all — there is nothing left to copy,
          paste, or extract. The masked digits are genuinely gone from the file,
          not hidden behind a shape.
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22 }}>How to hide the Aadhaar number in your PDF</h2>
        <ol>
          <li>
            Drop your PDF into the tool above (or tap to pick it from your files
            on a phone). Up to 20 MB; JPG and PNG work too.
          </li>
          <li>
            Your browser reads each page, runs Tesseract OCR on it, and looks for
            a 12-digit Aadhaar number, validating each candidate with the UIDAI
            Verhoeff checksum so random 12-digit strings are not masked by
            mistake. It also finds the UIDAI secure QR code, your face, and any
            PAN or passport MRZ on the page.
          </li>
          <li>
            Review the detections. Each one is a checkbox — the first 8 Aadhaar
            digits, the QR, the photo. Confirm what should be covered (everything
            is on by default) and switch off anything that was a false positive.
          </li>
          <li>
            Download. The tool flattens each page to an image and writes a new
            image-only PDF named <code>[original]_redacted.pdf</code>, entirely in
            your browser.
          </li>
        </ol>
        <p>
          For multi-page PDFs, detection runs on every page up front and the
          preview lets you move through pages with prev/next, so you can confirm
          each page before downloading.
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22 }}>If your eAadhaar PDF is password-protected</h2>
        <p>
          The official eAadhaar you download from the UIDAI portal is encrypted —
          it asks for a password every time you open it. This tool cannot open an
          encrypted PDF, so you need to remove the password first, and you can do
          that without any online service:
        </p>
        <ol>
          <li>
            Open the eAadhaar in any PDF viewer and enter your password. The UIDAI
            password is the first four letters of your name in capitals followed
            by your year of birth — for example, a person named Suresh born in
            1990 would use <code>SURE1990</code>.
          </li>
          <li>
            Use the viewer&apos;s Print → &ldquo;Save as PDF&rdquo; (or
            &ldquo;Microsoft Print to PDF&rdquo;) to save a fresh, unprotected copy
            to your device.
          </li>
          <li>Drop that unprotected copy into the tool above.</li>
        </ol>
        <p>
          That unprotected copy is created and used entirely on your device — it
          is never uploaded anywhere, and you can delete it once you have your
          redacted version.
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22 }}>Why the output is image-only (and larger)</h2>
        <p>
          The thing that makes the redaction trustworthy — discarding the text
          layer — is also the thing that makes the output a pure image PDF. That
          has two visible trade-offs: the file is typically 2–5× the size of the
          input, and you can no longer Ctrl+F search its text. For a document you
          are sharing as proof of identity, that is the right trade: you are
          paying file size for the guarantee that your masked Aadhaar number
          cannot be text-extracted by whoever receives it. The disclaimer under
          the download button states this so the recipient is not surprised by a
          non-searchable file.
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22 }}>You can verify the privacy claim yourself</h2>
        <p>
          Your Aadhaar PDF never leaves your browser tab. There is no server in
          the loop to receive it — the tool is a static bundle that runs on your
          own device. Open DevTools → Network and watch while you redact: no
          request carries your file. Disconnect your internet after the page loads
          and it still works. And the full pipeline is open source on{' '}
          <a
            href="https://github.com/shadab127/doc-redact-in"
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub
          </a>{' '}
          under AGPL-3.0, with a CI test that fails the build if any
          document-carrying request is ever added.
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22 }}>Frequently asked questions</h2>
        <dl>
          {FAQ.map((f) => (
            <div key={f.q} style={{ marginBottom: 18 }}>
              <dt style={{ fontWeight: 600 }}>{f.q}</dt>
              <dd style={{ margin: '4px 0 0 0' }}>{f.a}</dd>
            </div>
          ))}
        </dl>
        {/* FAQPage schema is served as a same-origin static JSON file and
            linked via <link rel="alternate" type="application/ld+json">
            (declared in the route metadata) so it is not blocked by our
            strict CSP's script-src directive. Regenerate the static file
            via scripts/build-schema.mjs whenever the FAQ[] constant changes. */}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22 }}>Related</h2>
        <p>
          Working from a photo of the card instead?{' '}
          <Link href="/mask-aadhaar-online">Mask Aadhaar online</Link>. Need to
          redact a PAN?{' '}
          <Link href="/redact-pan-card">Redact PAN card online</Link>. Want the
          architecture? <Link href="/how-it-works">How it works</Link>.
        </p>
      </section>
    </main>
  );
}
