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
import { REDACT_PAN_FAQ } from '@/src/content/faq';

const RedactorApp = dynamic(
  () => import('@/src/ui/RedactorApp').then((m) => m.RedactorApp),
  { ssr: false }
);

export const metadata: Metadata = {
  title: 'Redact PAN Card Online — Free, Browser-Only, Open Source | DocRedact.in',
  description:
    'Black out your PAN number and photo in your browser. Nothing uploaded, nothing stored, nothing analyzed. Free forever, open source (AGPL-3.0). Works on JPG, PNG, and PDF.',
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
          Your Permanent Account Number ties together your income-tax records,
          bank accounts, mutual-fund folios, demat holdings, and most financial
          KYC in India. It is requested constantly — by employers during
          onboarding, by landlords, by brokers, by every fintech signup — and it
          is very often requested when the recipient only needs to confirm your
          name or your taxpayer category, not the number itself. Every copy you
          send is a copy that can leak later from someone else&apos;s inbox,
          laptop, or storage bucket. A leaked PAN combined with a name and date
          of birth is enough to seed impersonation and fraudulent account
          opening, which is exactly why reducing how many full copies exist in
          the world is worth the thirty seconds it takes to mask one.
        </p>
        <p>
          Unlike Aadhaar, PAN has no official partial-mask convention — there is
          no &ldquo;show the last four&rdquo; standard. So this tool covers the
          entire 10-character number with a solid black rectangle. The face
          photograph printed on the card is covered too, because a PAN scan that
          shows your face plus your name plus your father&apos;s name is a small
          identity dossier on its own.
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
          Aadhaar we can mathematically reject almost every false positive; for
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
          PDF input is handled by rasterizing each page to a canvas at double
          resolution with pdf.js, then running the same detection pass on that
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
          Most online &ldquo;redact your document&rdquo; tools have a server that
          receives your file. They promise not to look at it, and you have to take
          their word for it. DocRedact.in has no such server in the loop. The tool
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
            Disconnect from the internet after the page loads. The redaction still
            works — there is no server call to depend on.
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
            . A continuous-integration test asserts that no document-carrying
            request ever leaves the tab during redaction; if anyone tries to add
            server-side processing, that test fails and the change cannot merge.
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
