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
import { MASK_AADHAAR_FAQ } from '@/src/content/faq';

const RedactorApp = dynamic(
  () => import('@/src/ui/RedactorApp').then((m) => m.RedactorApp),
  { ssr: false }
);

export const metadata: Metadata = {
  title: 'Mask Aadhaar Online — Free, Browser-Only, Open Source | DocRedact.in',
  description:
    'Redact your Aadhaar number, photo, and QR in your browser. Nothing uploaded, nothing stored, nothing analyzed. Free forever, open source (AGPL-3.0). Works on mobile.',
  alternates: {
    canonical: '/mask-aadhaar-online',
    types: {
      'application/ld+json': '/schema/mask-aadhaar-online.json',
    },
  },
  openGraph: {
    title: 'Mask Aadhaar Online — Browser-Only, Open Source',
    description:
      'Your browser masks the first 8 digits of your Aadhaar, covers the photo, and gives you a clean PDF. Nothing leaves your device.',
    type: 'article',
  },
};

export default function MaskAadhaarOnlinePage() {
  const FAQ = MASK_AADHAAR_FAQ;
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
      <Link href="/" style={{ fontSize: 13 }}>
        ← DocRedact.in
      </Link>

      <h1 style={{ fontSize: 32, margin: '24px 0 8px' }}>Mask Aadhaar online</h1>
      <p style={{ fontSize: 18, color: 'var(--muted)', marginTop: 0 }}>
        Your browser redacts the first 8 digits of your Aadhaar, covers the
        photo, and hides the UIDAI QR. Nothing uploaded. Nothing stored. Free
        forever.
      </p>

      <RedactorApp />

      <section style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 22 }}>Why mask Aadhaar at all</h2>
        <p>
          Your Aadhaar number is a shared secret that unlocks a lot — eKYC flows,
          DigiLocker, subsidy claims, bank-account linkage. UIDAI and the RBI have
          both issued circulars reminding citizens to share masked Aadhaar (first
          8 digits hidden, last 4 visible) whenever a full Aadhaar is not
          strictly required. With the Digital Personal Data Protection Act rules
          notified in November 2025, companies that receive your Aadhaar are now
          data fiduciaries under the Act, and they face enhanced liability if
          they mishandle it. Reducing the Aadhaar data you hand out reduces the
          risk of that mishandling affecting you. Even when a portal will
          technically accept your full Aadhaar, sending the masked version is the
          cautious default.
        </p>
        <p>
          The concrete risk is not abstract. Scanned Aadhaar copies sent over
          email, WhatsApp, or third-party HR portals are routinely leaked — from
          broker-site scrapes, from forgotten S3 buckets, from a recruiter&apos;s
          personal laptop. Once your 12-digit Aadhaar number plus a photo of your
          face plus your date of birth are in a dump, the combination is enough
          for a surprising number of impersonation flows. Masked Aadhaar is not
          a cryptographic guarantee of anything, but it removes 8 digits from the
          leak, which is the difference between a low-effort lookup and actual
          reconstruction.
        </p>
        <p>
          UIDAI does provide a masked-Aadhaar download on their portal, but it
          is a five-step OTP flow that requires a working Aadhaar-linked mobile
          number and network connectivity to UIDAI. If you are trying to email
          your masked Aadhaar to a landlord at 10pm on a Sunday from a phone
          with spotty signal, that flow is not great. DocRedact.in is the
          offline alternative: one photo, one tap, one download, no OTP, no
          dependency on a government portal being up. The masking follows the
          same first-8-digits convention UIDAI itself uses, so recipients who
          are used to the UIDAI format recognize the output immediately.
        </p>
        <p>
          The tool also masks PAN (full number, since PAN has no partial-mask
          convention), passport MRZ (the two-line machine-readable zone at the
          bottom of the photo page), and the UIDAI secure QR code. The QR
          matters because a decoded QR contains the full Aadhaar number, DOB,
          gender, and address — so masking only the printed digits while leaving
          the QR intact accomplishes almost nothing. Everything happens in the
          same pass on the same page.
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22 }}>How our tool works</h2>
        <p>
          When you drop a file or take a photo, your browser runs three things
          on your device: (1) Tesseract, an open-source OCR engine, reads the
          text on the card; (2) a tiny face detector finds your photograph; (3)
          a QR decoder looks for the UIDAI secure QR. Each of these is a
          WebAssembly module that is loaded only when you actually use the tool
          — no heavy bundle on first page load. Detected Aadhaar numbers are
          validated with the Verhoeff checksum that UIDAI itself uses, so any
          random 12 digits that happen to match the regex (phone numbers, order
          IDs, OCR errors) are correctly rejected rather than masked. Verhoeff
          validation is the difference between a tool that masks the wrong 12
          digits (worse than useless) and a tool you can actually trust.
        </p>
        <p>
          PDF input goes through an extra step: each page is rasterized to a
          canvas at double resolution via pdf.js, then the detection pipeline
          runs on that canvas as if it were a photograph. This means the tool
          handles both camera-captured scans and native PDFs from official
          portals, without treating them differently. Multi-page PDFs run the
          detection on every page up front, so when you open the preview you
          can navigate across pages and see what was found on each.
        </p>
        <p>
          The detected regions are drawn onto a canvas in your browser as solid
          black rectangles over the first 8 Aadhaar digits, over the PAN, over
          the UIDAI QR, and over the face photograph. (We originally used a
          Gaussian blur on the face but switched to a solid rectangle — blur
          can be reversed with known-σ deblurring and modern face
          super-resolution; a solid rectangle cannot.) The
          page image and the mask layer are then flattened together and written
          into a new image-only PDF in your browser, again using an open-source
          library. The flattening step is what makes the output safe to email
          — because the output has no text layer at all, nothing running
          `pdftotext` or doing a copy-paste will recover the masked digits.
          The tradeoff is that the output PDF is larger than the input (usually
          2–5×) and is not searchable, which is worth paying for a card that
          you are sharing as proof of identity.
        </p>
        <p>
          When you click Download, you are downloading a Blob that the browser
          built locally from the flattened PDF bytes. Your operating system
          treats it exactly as if you had saved a file you created yourself.
          It never traversed our infrastructure because our infrastructure
          never saw it. The browser does not forward the download through any
          server — there is no server to forward it through.
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22 }}>Why the privacy story is real and verifiable</h2>
        <p>
          Most online redactors promise privacy in the way a hotel promises it
          will not read your mail. There is a server somewhere; they claim they
          will not look at the file; you have to take their word for it. That
          model can be fine if the operator has legal incentives aligned with
          yours, but it is fundamentally a promise — there is nothing a user
          can check from the outside. Our privacy model is different because
          there is nothing there to trust. The tool is a static bundle of
          JavaScript, HTML, and WebAssembly that your browser downloads when
          you visit the page. Everything runs on your CPU, in your tab. You
          can check this in three ways:
        </p>
        <ul>
          <li>
            Open your browser&apos;s DevTools (right-click → Inspect on desktop;
            dev-tools enabled from Settings → Safari → Advanced on iOS), switch
            to the Network tab, then use the tool. You will not see any request
            carrying your document.
          </li>
          <li>
            Disconnect your internet after the page has loaded. The tool still
            works. No redaction feature depends on a server call. The lazy
            WASM modules are cached by your browser after first use, so
            subsequent redactions on the same device work fully offline.
          </li>
          <li>
            Read the code on{' '}
            <a
              href="https://github.com/shadabkhan/doc-redact-in"
              rel="noopener noreferrer"
              target="_blank"
            >
              GitHub
            </a>
            . The detection pipeline, the mask renderer, and the PDF writer are
            all in the repository under an AGPL-3.0 licence. A continuous
            integration test in the repository asserts that no network request
            carrying document data escapes the tab during redaction; if someone
            ever tries to add server-side processing, that test fails and the
            pull request cannot merge.
          </li>
        </ul>
        <p>
          We still ship two network-visible pieces, and we want to be explicit
          about them. First, the page uses Cloudflare Web Analytics, which
          counts page views from same-origin only and captures nothing about
          your document — no file size, no OCR text, no detection coordinates,
          no filenames. It is the single small beacon per page view that you
          will see in the Network tab. Second, the optional contact form and
          B2B waitlist form send their own fields (email, company name,
          message) to a Cloudflare Worker so we can respond to you. Neither of
          those two requests happens during redaction, and neither carries any
          part of your uploaded file. If you never touch the forms, neither
          beacon ever carries any personal data.
        </p>
        <p>
          The AGPL licence is the other half of the verifiability story. If
          someone builds a closed-source hosted service on top of this codebase
          (for example, by putting it behind a SaaS signup wall), the AGPL
          requires them to publish their source too. That means the tool
          cannot quietly become a spy; any serious fork has to show its work.
          We are not opposed to commercial derivatives — we run a B2B API
          ourselves — we just think the mechanism for trust should be verifiable
          rather than contractual.
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
            via scripts/build-schema.ts whenever the FAQ[] constant changes. */}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22 }}>Verify for yourself</h2>
        <p>
          The repository at{' '}
          <a
            href="https://github.com/shadabkhan/doc-redact-in"
            rel="noopener noreferrer"
            target="_blank"
          >
            github.com/shadabkhan/doc-redact-in
          </a>{' '}
          contains every line of detection, preprocessing, masking, and
          PDF-rewriting code used on this page. Commit history is preserved
          (no squashes, no force-pushes on main). External contributions are
          welcome. See <Link href="/how-it-works">how it works</Link> for an
          architecture diagram, or <Link href="/privacy">our privacy policy</Link>
          {' '}for the plain-English version of the data practices described
          above.
        </p>
      </section>

    </main>
  );
}
