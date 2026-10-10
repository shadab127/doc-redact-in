/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import type { Metadata } from 'next';
import { RedactorApp } from '@/src/ui/ClientRedactors';
import Link from 'next/link';
import { REDACT_PAN_FAQ } from '@/src/content/faq';

export const metadata: Metadata = {
  title: 'Redact PAN Card Online — Free, Browser-Only, Open Source | DocRedact.in',
  description:
    'Mask detected PAN numbers and photos locally in your browser. No document upload. Free, open source (AGPL-3.0). Works on JPG, PNG, WebP, and PDF.',
  alternates: {
    canonical: '/redact-pan-card',
    types: {
      'application/ld+json': '/schema/redact-pan-card.json',
    },
  },
  openGraph: {
    title: 'Redact PAN Card Online — Browser-Only, Open Source',
    description:
      'Your browser covers your PAN number and photo and gives you a clean image-only PDF. Nothing leaves your device.',
    type: 'article',
  },
};

export default function RedactPanCardPage() {
  const FAQ = REDACT_PAN_FAQ;
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
      <Link href="/" style={{ fontSize: 13 }}>
        ← DocRedact.in
      </Link>

      <h1 style={{ fontSize: 32, margin: '24px 0 8px' }}>Redact PAN card online</h1>
      <p style={{ fontSize: 18, color: 'var(--muted)', marginTop: 0 }}>
        Your browser blacks out your PAN number and photo and hands back a clean
        image-only PDF. Nothing uploaded. Nothing stored. Free forever.
      </p>

      <RedactorApp />

      <section style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 22 }}>Why mask your PAN before sharing it</h2>
        <p>
          Sharing a PAN copy also shares the personal details visible on it.
          If the recipient does not need the full number or photograph, masking
          those fields reduces what you disclose. Ask which fields are required
          and whether a redacted copy is acceptable before sharing.
        </p>
        <p>
          This tool masks the entire detected 10-character PAN number. Detected
          photographs are also selected by default. Other details, such as names
          and dates, remain visible unless you cover them in manual mode.
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22 }}>How the PAN detection works</h2>
        <p>
          When you drop a card image or take a photo, your browser runs
          Tesseract — an open-source OCR engine compiled to WebAssembly — to read
          the text on the card. The tool then looks for the exact PAN shape: five
          letters, four digits, and a final letter (for example{' '}
          <code>ABCDE1234F</code>). A bare pattern match is not enough on its own,
          because OCR noise and other printed codes can resemble that shape, so
          the fourth character is checked against the valid PAN holder-type codes
          — <code>P</code> for an individual, <code>C</code> for a company,{' '}
          <code>H</code> for a Hindu Undivided Family, <code>F</code> for a firm,
          and so on. A candidate whose fourth character is not a real holder-type
          code is rejected rather than masked.
        </p>
        <p>
          One honest limitation worth stating plainly: PAN does not carry a public
          checksum the way an Aadhaar number carries its Verhoeff check digit. For
          Aadhaar we use a checksum to reject invalid digit strings; a valid
          checksum does not prove that a region is an Aadhaar number. For
          PAN the defences are the strict character structure and the holder-type
          gate, which are strong but not a checksum. That is one of the reasons
          every detection on this site appears as a checkbox in a review list
          before anything is written — you confirm the box is over your real PAN,
          and you can switch off anything that was picked up by mistake.
        </p>
        <p>
          The signature strip is not detected as its own field. If you want to
          hide your signature as well, use the{' '}
          <Link href="/manual">manual draw-to-redact mode</Link> to drag a
          rectangle over it before you download — manual rectangles flow through
          the exact same flattening step as the automatic detections.
        </p>
        <p>
          PDF input is handled by rasterizing each page to a canvas at three times
          its base resolution with pdf.js, then running the same detection pass on that
          canvas. The masked regions are drawn as solid black rectangles, the
          page image and the mask are flattened together, and a new image-only
          PDF is written in your browser with pdf-lib. Because the output has no
          text layer, the masked PAN cannot be recovered with copy-paste or{' '}
          <code>pdftotext</code>.
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22 }}>Why the privacy story is real and verifiable</h2>
        <p>
          DocRedact.in does not send your file to a server for redaction. The tool
          is a static bundle of JavaScript, HTML, and WebAssembly that your
          browser downloads when you open the page; every step after that runs on
          your own CPU, in your own tab. You can check this three ways:
        </p>
        <ul>
          <li>
            Open DevTools, switch to the Network tab, and use the tool. No request
            carrying your PAN card goes out.
          </li>
          <li>
            First use downloads the detection software and model assets. Offline
            use requires those assets to remain available in your browser cache;
            loading the page alone does not guarantee offline use.
          </li>
          <li>
            Read the code on{' '}
            <a
              href="https://github.com/shadab127/doc-redact-in"
              rel="noopener noreferrer"
              target="_blank"
            >
              GitHub
            </a>
            . Browser privacy tests check requests during detection and export,
            including same-origin requests. These tests are a regression check,
            not a guarantee about every possible file or browser.
          </li>
        </ul>
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
          Masking an Aadhaar instead?{' '}
          <Link href="/mask-aadhaar-online">Mask Aadhaar online</Link>. Working
          with a downloaded PDF?{' '}
          <Link href="/hide-aadhaar-number-pdf">Hide an Aadhaar number in a PDF</Link>
          . Want the architecture?{' '}
          <Link href="/how-it-works">How it works</Link>, or read{' '}
          <Link href="/privacy">our privacy policy</Link>.
        </p>
      </section>
    </main>
  );
}
