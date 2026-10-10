// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
export interface FaqEntry {
  q: string;
  a: string;
}

export const MASK_AADHAAR_FAQ: readonly FaqEntry[] = [
  {
    q: 'Is my Aadhaar uploaded to this site?',
    a: 'No. Your browser reads and masks your document locally. Software assets and optional Cloudflare Web Analytics requests use the network, but they do not carry your document. You can inspect requests in DevTools → Network and read the source on GitHub.',
  },
  {
    q: 'What does masked or redacted Aadhaar mean?',
    a: 'Masked Aadhaar hides the first 8 digits of the 12-digit number, leaving the last 4 visible. DocRedact creates a locally redacted copy of a file you already have, not an official UIDAI-issued download. Check which fields your recipient requires before sharing.',
  },
  {
    q: 'What does this tool mask?',
    a: 'Detected Aadhaar numbers have their first 8 digits selected. Detected PAN numbers, passport MRZ regions, probable UIDAI QR codes and faces are also selected by default. Tinted selections show the exported mask boundaries. Uncheck unwanted detections and use manual mode to cover missed content. Other QR codes are masked only if you select them.',
  },
  {
    q: 'Can I use this on my phone?',
    a: 'Yes. Take a photo, choose an existing file, or try the synthetic sample. Processing runs in your mobile browser. Use a clear JPG or PNG photo and review the result before downloading.',
  },
  {
    q: 'What file types and limits apply?',
    a: 'JPG, PNG, WebP and PDF up to 20 MB, with up to 10 PDF pages. There is also a 40-million-pixel budget per page and an 80-million-pixel budget for the document; PDF budgets apply after rasterization. Large files may need resizing or splitting. Password-protected PDFs must first be saved as an unprotected copy on your device.',
  },
  {
    q: 'Can it download masked Aadhaar without OTP?',
    a: 'No. DocRedact does not retrieve Aadhaar or bypass UIDAI authentication. It masks a document you already have. For an official masked Aadhaar download, use the UIDAI myAadhaar portal and follow its requirements.',
  },
  {
    q: 'Does it access the UIDAI database or decode QR codes?',
    a: 'It does not access the UIDAI database. QR codes are decoded locally to help classify them, and detected faces are located locally without identifying the person. QR contents, OCR text and document pixels are not sent to a server. QR codes can contain personal information, so review them as well as the printed number.',
  },
  {
    q: 'Can the masked content be recovered from the output?',
    a: 'The export paints solid rectangles onto page images and creates a new image-only PDF. It does not retain the original text layer or removable mask shapes. This protects the regions actually covered, not content the detector missed. Open the downloaded file and verify every page before sharing. File size varies and text search is unavailable.',
  },
  {
    q: 'Why is this free?',
    a: 'The consumer tool is free and open source. A browser-side integration for businesses is planned, but is not available yet. The API waitlist is for updates and discussions about that future offering.',
  },
];

export const REDACT_PAN_FAQ: readonly FaqEntry[] = [
  {
    q: 'Is my PAN card uploaded?',
    a: 'No. OCR, detection and export run in your browser. Network requests load software and optional page analytics, not your document. Inspect DevTools → Network or read the source on GitHub.',
  },
  {
    q: 'What part of the PAN card is masked?',
    a: 'The detected full 10-character PAN number and face photograph are selected by default. Detected Aadhaar numbers, passport MRZ regions and probable UIDAI QR codes are also selected. Review each selection and check which fields the recipient needs.',
  },
  {
    q: 'How does PAN detection work?',
    a: 'Local OCR looks for five letters, four digits and a final letter, then checks the fourth character against PAN holder-type codes. These checks reduce false positives but do not prove a number is a real PAN. Detection can miss content or select a wrong region; review the output.',
  },
  {
    q: 'Does it cover my signature?',
    a: 'Signatures are not detected automatically. Use manual mode to draw a rectangle over your signature or any other content you want hidden.',
  },
  {
    q: 'What files and sizes work?',
    a: 'JPG, PNG, WebP and PDF up to 20 MB and 10 PDF pages, subject to the 40-million-pixel per-page and 80-million-pixel document budgets after rasterization. Resize large images or split large PDFs if needed.',
  },
  {
    q: 'What does the output contain?',
    a: 'A new image-only PDF with selected regions painted solid black, no original text layer and no removable mask shapes. The source file is unchanged. Unmasked personal details remain visible; verify every page before sharing.',
  },
  {
    q: 'Why is this free?',
    a: 'The consumer tool is free and open source. A browser-side business integration is planned, not currently available. Join the API waitlist for updates.',
  },
];

export const HIDE_AADHAAR_PDF_FAQ: readonly FaqEntry[] = [
  {
    q: 'Is my Aadhaar PDF uploaded?',
    a: 'No. Your browser parses, masks and exports it locally. First use downloads software assets, and optional analytics sends page usage statistics, but no request carries your document.',
  },
  {
    q: 'Does a password-protected eAadhaar PDF work?',
    a: 'Not directly. Open the PDF in a trusted local viewer using your password, then use Print → Save as PDF if the viewer permits it to create an unprotected copy. Choose that copy in DocRedact. Keep it on your device and delete it when no longer needed.',
  },
  {
    q: 'What does it hide in the PDF?',
    a: 'Detected first 8 Aadhaar digits, probable UIDAI QR codes, faces, PAN numbers and passport MRZ regions are selected by default. The last 4 Aadhaar digits stay visible. Review selections, uncheck unwanted regions and use manual mode to cover anything missed.',
  },
  {
    q: 'Does it remove the original text layer?',
    a: 'Yes. Every exported page is a new image with solid masks already painted onto it. The output has no original text layer or removable mask shapes. This only protects covered regions; review all pages for missed content.',
  },
  {
    q: 'Does it work on multi-page PDFs?',
    a: 'Yes, up to 20 MB and 10 pages, subject to a 40-million-pixel budget per rasterized page and 80 million pixels for the document. Review each page with the preview controls. Split a PDF if it exceeds the memory budget.',
  },
  {
    q: 'What about the Aadhaar QR code?',
    a: 'QR codes can carry personal details separately from the printed number. DocRedact decodes them locally and selects probable UIDAI QR codes, but classification and detection can be wrong. Review every QR and use manual mode if needed.',
  },
  {
    q: 'Why is the output not searchable?',
    a: 'The export discards the original text layer so covered text is not retained underneath a mask. The resulting image-only PDF is not searchable and may be larger than the input.',
  },
  {
    q: 'Why is this free?',
    a: 'The consumer tool is free and open source. A browser-side business integration is planned, not currently available. Join the API waitlist for updates.',
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
