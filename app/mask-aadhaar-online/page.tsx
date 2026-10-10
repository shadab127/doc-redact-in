// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import type { Metadata } from 'next';
import { RedactorApp } from '@/src/ui/ClientRedactors';
import Link from 'next/link';
import { MASK_AADHAAR_FAQ } from '@/src/content/faq';

export const metadata: Metadata = {
  title: 'Mask Aadhaar Online — Free, Browser-Only, Open Source | DocRedact.in',
  description:
    'Mask the first 8 Aadhaar digits in an existing JPG, PNG, WebP or PDF. Review and download in your browser. No document upload. Free, open source, mobile-friendly.',
  alternates: {
    canonical: '/mask-aadhaar-online/',
    types: { 'application/ld+json': '/schema/mask-aadhaar-online.json' },
  },
  openGraph: {
    title: 'Mask Aadhaar Online — Browser-Only, Open Source',
    description:
      'Mask an Aadhaar file you already have. Review the selected regions and download an image-only PDF without uploading your document.',
    type: 'article',
  },
};

export default function MaskAadhaarOnlinePage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
      <Link href="/" style={{ fontSize: 13 }}>← DocRedact.in</Link>
      <h1 style={{ fontSize: 32, margin: '24px 0 8px' }}>Mask Aadhaar online</h1>
      <p style={{ fontSize: 18, color: 'var(--muted)', marginTop: 0 }}>
        Mask an Aadhaar photo or PDF you already have. Your browser finds the
        number and selects the first 8 digits to hide, leaving the last 4 visible.
        Nothing uploaded. Free and open source.
      </p>

      <RedactorApp sampleUrl="/samples/sample-aadhaar.svg" />

      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 22 }}>Choose, review, download</h2>
        <ol>
          <li>Choose a JPG, PNG, WebP or PDF, or take a photo on your phone.</li>
          <li>
            Review every page. The tinted selections show the regions that will
            become solid black. Uncheck unwanted detections, and use manual mode
            to cover anything missed.
          </li>
          <li>Download a new image-only PDF, then open it and check it before sharing.</li>
        </ol>
        <p>
          Detected faces, probable UIDAI QR codes, PAN numbers and passport MRZ
          regions are also selected by default. Check what the recipient needs
          before hiding your photo or other identity fields. Detection can miss
          content or select the wrong region.
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22 }}>What is masked or redacted Aadhaar?</h2>
        <p>
          Masking means hiding part of the number. A masked Aadhaar shows only
          the last 4 of its 12 digits. Redaction removes selected content from
          the copy you share; it does not change the original file.
        </p>
        <p>
          DocRedact uses solid black rectangles and rebuilds each page as an
          image-only PDF. The exported file has no original text layer or
          removable mask shapes. It is not searchable and may be larger than
          your input. Other personal details remain visible unless you mask them.
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22 }}>Need to download Aadhaar from UIDAI?</h2>
        <p>
          DocRedact works with a file you already have. It does not retrieve your
          Aadhaar, connect to the UIDAI database, bypass OTP verification, or
          issue an official masked Aadhaar. For an official download, use{' '}
          <a href="https://myaadhaar.uidai.gov.in/" target="_blank" rel="noopener noreferrer">
            UIDAI&apos;s myAadhaar portal
          </a>{' '}
          and follow its current requirements. Ask the recipient whether a
          locally redacted copy is acceptable.
        </p>
        <p>
          Password-protected PDFs need to be opened and saved as an unprotected
          copy on your device first. See{' '}
          <Link href="/hide-aadhaar-number-pdf/">the PDF guide</Link>.
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22 }}>Private processing you can inspect</h2>
        <p>
          OCR, face detection, QR decoding and PDF export run locally. The first
          redaction downloads the required software and model assets from this
          site; no request carries your document. Offline use depends on those
          assets being loaded and available in the browser cache, so loading the
          page alone is not enough.
        </p>
        <p>
          Open DevTools → Network to inspect requests, or read the{' '}
          <a href="https://github.com/shadab127/doc-redact-in" target="_blank" rel="noopener noreferrer">
            source and privacy tests on GitHub
          </a>
          . Cloudflare Web Analytics makes separate requests for page usage
          statistics. Contact and waitlist forms send only the fields you submit.
          See <Link href="/privacy/">the privacy policy</Link> and{' '}
          <Link href="/how-it-works/">how it works</Link>.
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22 }}>Frequently asked questions</h2>
        <dl>
          {MASK_AADHAAR_FAQ.map((f) => (
            <div key={f.q} style={{ marginBottom: 18 }}>
              <dt style={{ fontWeight: 600 }}>{f.q}</dt>
              <dd style={{ margin: '4px 0 0 0' }}>{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
