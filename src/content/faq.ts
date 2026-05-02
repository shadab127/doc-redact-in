/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */

export interface FaqEntry {
  q: string;
  a: string;
}

export const MASK_AADHAAR_FAQ: readonly FaqEntry[] = [
  {
    q: 'Is it safe to upload my Aadhaar to this site?',
    a: 'You are not uploading anything. DocRedact.in runs entirely in your browser tab — no server ever sees your file. Open your browser DevTools → Network tab while you use it and verify this for yourself. Our code is public on GitHub under AGPL-3.0.',
  },
  {
    q: 'What is masked Aadhaar, and why do I need it?',
    a: 'A masked Aadhaar hides the first 8 digits of your 12-digit Aadhaar number, leaving only the last 4 visible. UIDAI and the RBI recommend using masked Aadhaar instead of the full card whenever possible — for KYC verification, tenancy agreements, employment onboarding, and similar flows where someone needs proof of identity but not your full Aadhaar number. Under the DPDP Act (rules notified November 2025), data fiduciaries who mishandle Aadhaar face fiduciary liability, so many now prefer receiving masked copies.',
  },
  {
    q: 'What does this tool actually mask?',
    a: 'By default: (1) the first 8 digits of your Aadhaar number, (2) your PAN number, (3) passport MRZ (machine-readable zone), (4) the UIDAI QR code, and (5) your face photograph on the card. Each detection appears as a checkbox — you can uncheck anything that is a false positive or that you want to leave visible.',
  },
  {
    q: 'Can I use this on my phone?',
    a: 'Yes. On mobile, the primary button is "📷 Take Photo" — it opens your phone camera, you photograph the card, and the redaction runs entirely on-device. No photo gallery upload, no server round-trip.',
  },
  {
    q: 'What file types work?',
    a: 'JPG, PNG, and PDF, up to 20 MB. PDFs are re-rendered as image-only PDFs (no searchable text layer) so nothing can be recovered via pdftotext or similar tools.',
  },
  {
    q: 'How does the Aadhaar detection work?',
    a: 'The tool runs Tesseract OCR on your document in the browser, finds any 12-digit sequence, and validates it against UIDAI\'s Verhoeff checksum. Only numbers that pass the Verhoeff check are treated as Aadhaar candidates — this prevents false positives from phone numbers, order IDs, or garbled OCR.',
  },
  {
    q: 'Does the tool read my biometric data or Aadhaar database?',
    a: 'No. It does not touch the UIDAI database, does not resolve the QR payload, and does not extract biometric information. It only finds the printed number, the photo, and the QR on the paper/PDF card in front of you.',
  },
  {
    q: 'Is the output file safe to email or upload to a portal?',
    a: 'The output PDF is flattened to an image-only PDF — the original text layer is discarded, so whoever receives it cannot extract the masked digits with copy-paste or pdftotext. The masked regions are drawn as solid black rectangles on the image, so they cannot be un-masked. You should still verify the output before sharing.',
  },
  {
    q: 'Why is the output file bigger than the input?',
    a: 'Image-only PDFs are larger than text-layer PDFs — that is the cost of guaranteeing that masked content cannot be text-extracted. Expect 2–5× the input size for typical scans.',
  },
  {
    q: 'Why are you giving this away free?',
    a: 'The consumer tool is free forever; we make money through an API for businesses (HR tech, fintech KYC) that need to integrate this into their pipelines. See /api-waitlist if that is you.',
  },
];

export function buildFaqSchema(faq: readonly FaqEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
