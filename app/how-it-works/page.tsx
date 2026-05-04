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
  title: 'How it works — DocRedact.in',
  description:
    'Every detection, mask, and PDF rewrite happens on your device. Here is the architecture diagram and the open-source code.',
};

export default function HowItWorksPage() {
  return (
    <TextPage title="How it works">
      <p>
        DocRedact.in is a zero-server redactor. No file you drop on the page
        ever leaves your browser tab. Here is the full pipeline.
      </p>

      <h2>Pipeline</h2>
      <pre
        style={{
          background: '#111318',
          padding: 16,
          borderRadius: 8,
          fontSize: 12,
          overflow: 'auto',
          lineHeight: 1.4,
        }}
      >
{`Your browser tab
  ├── File drop / 📷 Take Photo
  ├── PDF ? → pdf.js rasterize each page to canvas (2x)
  │   Image ? → draw to canvas
  ├── Parallel:
  │     ├── Tesseract.js OCR (English, WASM, lazy)
  │     ├── face-api TinyFaceDetector (WASM, lazy, threshold 0.6)
  │     └── zxing-wasm QR scan (lazy)
  ├── Regex + Verhoeff:
  │     ├── Aadhaar (12 digit + Verhoeff check → mask first 8)
  │     ├── PAN (AAAAA9999A + entity-code check)
  │     └── Passport MRZ (ICAO 9303, Indian country code)
  ├── Review toggles → you choose what actually masks
  ├── Canvas mask render:
  │     └── Solid black rectangles for every masked region (text, QR, face)
  └── pdf-lib: JPEG embed each flattened page → image-only PDF → download

No network hop between any of these steps carries document data.`}
      </pre>

      <h2>Open source</h2>
      <p>
        The full source is at{' '}
        <a
          href="https://github.com/shadab127/doc-redact-in"
          rel="noopener noreferrer"
          target="_blank"
        >
          github.com/shadab127/doc-redact-in
        </a>
        , licensed under AGPL-3.0-or-later. The key source files to look at if
        you want to verify the privacy story yourself:
      </p>
      <ul>
        <li>
          <code>src/detection/DetectionOrchestrator.ts</code> — the top of the
          pipeline. Notice that the inputs are only canvases and blobs; no
          document bytes ever leave this module.
        </li>
        <li>
          <code>src/masking/PdfFlattener.ts</code> — the PDF builder. It calls{' '}
          <code>pdf-lib</code>, which itself emits a <code>Uint8Array</code>{' '}
          locally; the &ldquo;download&rdquo; step wraps that array in a Blob
          and triggers a same-tab save.
        </li>
        <li>
          <code>tests/e2e/no-outbound-network.spec.ts</code> — the Playwright
          test that asserts no document-data request ever leaves the origin
          during redaction.
        </li>
      </ul>

      <h2>What gets loaded from the network</h2>
      <p>
        Three categories of static asset are fetched, all same-origin from
        Cloudflare Pages:
      </p>
      <ul>
        <li>
          The HTML / JavaScript / CSS of this page (obvious).
        </li>
        <li>
          The Tesseract, face-api, and zxing-wasm WebAssembly bundles — fetched
          lazily the first time you run a redaction so they do not bloat the
          initial page load.
        </li>
        <li>
          The TinyFaceDetector model weights from <code>/models/</code> — about
          200 KB, fetched on first face detection.
        </li>
      </ul>
      <p>
        Cloudflare Web Analytics sends one small beacon per page view to a
        Cloudflare-hosted endpoint. It contains a page URL and a referrer, and
        is cookie-free. You can see these requests in DevTools — they do not
        carry any part of your document.
      </p>
    </TextPage>
  );
}
