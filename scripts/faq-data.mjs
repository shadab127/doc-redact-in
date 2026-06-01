/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 *
 * Mirror of src/content/faq.ts for build scripts. A vitest check ensures the
 * two lists stay in sync — edit both or neither.
 */

export const MASK_AADHAAR_FAQ = [
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
    a: "The tool runs Tesseract OCR on your document in the browser, finds any 12-digit sequence, and validates it against UIDAI's Verhoeff checksum. Only numbers that pass the Verhoeff check are treated as Aadhaar candidates — this prevents false positives from phone numbers, order IDs, or garbled OCR.",
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

export const REDACT_PAN_FAQ = [
  {
    q: 'Is it safe to redact my PAN card on this site?',
    a: 'You are not uploading your PAN anywhere. DocRedact.in runs entirely in your browser tab — no server ever receives your file, your PAN number, or the text read from it. Open your browser DevTools → Network tab while you use the tool and watch: nothing carrying your document leaves your device. The full code is public on GitHub under AGPL-3.0.',
  },
  {
    q: 'What part of the PAN card does the tool mask?',
    a: 'The full 10-character PAN (for example ABCDE1234F) is covered with a solid black rectangle. PAN has no official partial-mask convention the way Aadhaar does (first 8 hidden, last 4 shown), so the whole number is masked. By default the tool also covers the photograph and any Aadhaar number, passport MRZ, or UIDAI QR it finds on the same page.',
  },
  {
    q: 'How does the tool know a string is a PAN?',
    a: 'Tesseract OCR reads the text on the card in your browser, and the tool looks for the exact PAN shape — five letters, four digits, one letter. It then checks that the fourth character is a valid PAN holder-type code (P for individual, C for company, H for HUF, F for firm, and so on). Strings that match the digit-letter pattern but fail the holder-type check are rejected. PAN has no public checksum the way Aadhaar has the Verhoeff digit, so this strict structure plus the holder-type gate is what keeps false positives low — but you should still review the detection before downloading.',
  },
  {
    q: 'Does it also cover my photo and signature on the PAN card?',
    a: 'It covers the photograph automatically (an on-device face detector finds it). The signature is not detected as a distinct field, so if you want to hide it, use the manual draw-to-redact mode to draw a rectangle over it before downloading.',
  },
  {
    q: 'Can I redact a PAN in both a photo and a PDF?',
    a: 'Yes. JPG, PNG, and PDF all work, up to 20 MB. A PDF is re-rendered page by page into a new image-only PDF, so the masked number cannot be recovered with copy-paste or pdftotext.',
  },
  {
    q: 'Why should I mask my PAN before sharing it?',
    a: 'Your PAN is linked to your bank accounts, tax records, mutual-fund and demat holdings, and most financial KYC. A leaked PAN plus a few other details is enough to enable impersonation and fraudulent account opening. Many portals ask for a PAN copy when they only need to confirm a name or a category — sharing a masked copy reduces what is exposed if that recipient is later breached.',
  },
  {
    q: 'What file types and sizes work?',
    a: 'JPG, PNG, and PDF up to 20 MB. Camera photos from modern phones (8–15 MB) are comfortably within the limit.',
  },
  {
    q: 'Is the output safe to email or upload?',
    a: 'The output is a flattened image-only PDF. The original text layer is discarded and the masked PAN is drawn as a solid black rectangle on the image, so the number cannot be text-extracted or un-masked. As with any redaction, verify the output before sharing.',
  },
  {
    q: 'Why is this free?',
    a: 'The consumer tool is free forever. Revenue comes from a B2B API for businesses (HR tech, fintech KYC) that integrate redaction into their pipelines. See /api-waitlist if that is you.',
  },
];

export const HIDE_AADHAAR_PDF_FAQ = [
  {
    q: 'Is it safe to open my Aadhaar PDF here?',
    a: 'Yes — because the PDF never leaves your browser tab. DocRedact.in has no server that receives your file. The PDF is parsed, redacted, and re-saved entirely on your device. You can confirm this in DevTools → Network, and read every line of the code on GitHub under AGPL-3.0.',
  },
  {
    q: 'My eAadhaar PDF is password-protected — does it work?',
    a: 'Not directly. The official UIDAI eAadhaar download is encrypted, and the tool cannot open an encrypted PDF. Remove the password first: open the PDF in any viewer using your password (the UIDAI password is the first four letters of your name in capitals followed by your year of birth, e.g. SURE1990), then use Print → Save as PDF to create an unprotected copy. Drop that copy into DocRedact.in. This extra step happens on your device too — the unprotected copy is never uploaded anywhere.',
  },
  {
    q: 'What does it hide in the PDF?',
    a: 'By default: the first 8 digits of any Aadhaar number it finds (last 4 stay visible, the UIDAI convention), the UIDAI secure QR code, your face photograph, and any PAN or passport MRZ on the page. Each detection is a checkbox you can toggle before downloading.',
  },
  {
    q: 'Does it actually remove the number from the text layer, or just cover it visually?',
    a: 'Both, and this is the key point for PDFs. A PDF that only has a black box drawn over the text still contains the original digits in its text layer — anyone can copy-paste or run pdftotext and recover them. DocRedact.in re-renders every page to an image and builds a new image-only PDF, so there is no text layer left at all. The masked digits are gone, not merely hidden.',
  },
  {
    q: 'Does it work on multi-page PDFs?',
    a: 'Yes. Detection runs on every page up front, and the preview lets you page through with prev/next to confirm what was found on each page before you download.',
  },
  {
    q: 'Why is the output PDF larger and not searchable?',
    a: 'Because it is image-only by design. Discarding the text layer is what guarantees the masked Aadhaar number cannot be text-extracted. The trade-off is a larger file (typically 2–5× the input) with no Ctrl+F search — worth it for a document you are sharing as proof of identity.',
  },
  {
    q: 'What about the QR code in the eAadhaar PDF?',
    a: 'The UIDAI secure QR encodes your full Aadhaar number, date of birth, gender, and address. Masking only the printed digits while leaving the QR readable would defeat the purpose, so the tool finds the UIDAI QR and covers it by default along with the number.',
  },
  {
    q: 'Can I do this on my phone?',
    a: 'Yes. The tool is mobile-first and runs the same on-device pipeline on a phone. You can open a PDF from your downloads or files app; everything is processed locally in the mobile browser.',
  },
  {
    q: 'Why is this free?',
    a: 'The consumer tool is free forever. Revenue comes from a B2B API for businesses (HR tech, fintech KYC) that integrate redaction into their pipelines. See /api-waitlist if that is you.',
  },
];

export function buildFaqSchema(faq) {
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
