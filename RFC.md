# RFC: DocRedact.in — MVP Technical Design

**Status:** Draft v2 (incorporates 20-question review)
**Author:** Shadab Khan
**Created:** 2026-05-01
**Updated:** 2026-05-02
**Target MVP:** v1.0 (5 weekends build + 3-week sequenced launch)
**License:** AGPL-3.0-or-later

---

## 1. Overview

A **client-side, mobile-first** open-source web application for redacting Indian identity documents (Aadhaar, PAN, passport MRZ, UIDAI QR, photograph) before sharing them over email, WhatsApp, or upload portals. Every byte of the document is processed in the user's browser tab. No file, thumbnail, OCR result, or detected PII ever leaves the device.

### 1.1 Positioning

**"Your browser redacts it. Nothing leaves your device. Open DevTools and verify for yourself — our code is public."**

UIDAI's own masked-Aadhaar download is a 5-step OTP portal. Existing global tools (iLovePDF, Smallpdf, Adobe) support generic redaction but have no India-specific auto-detection. Blogspot-era "Aadhaar masking tools" are ad-ridden and untrustworthy. DocRedact.in's wedge: **zero-server architecture + India-specific detectors + fully open-source code**.

### 1.2 Goals (MVP)

- Mobile-first landing page with camera-capture as primary hero CTA on mobile
- Drop an image (JPG/PNG) or PDF up to 20MB
- Auto-detect and mask: Aadhaar (12-digit, first 8 digits), PAN (AAAAA9999A), passport MRZ, UIDAI secure QR, face photograph
- User can toggle each detection off before download
- Output a **flattened image-only PDF** (no text layer — guarantees no `pdftotext` extraction of masked content)
- One SEO-optimized flagship landing page at launch
- Cloudflare Web Analytics (privacy-friendly, same-origin)
- B2B waitlist form (email + company + use case dropdown)
- Public GitHub repo, AGPL-3.0 licensed
- Plain-English privacy policy

### 1.3 Non-Goals (MVP)

- No server-side OCR, no server-side storage, no server-side PII handling — ever
- No accounts, no logins, no user dashboards
- No batch processing (Pro tier, post-MVP)
- No public REST API (B2B tier, post-MVP)
- No voter ID / driving licence / ration card detection (add based on search-volume data post-launch)
- No PWA / installable / offline mode (deferred until post-launch)
- No regional-language Tesseract packs (English only; Verhoeff filters false positives)
- No scenario presets / task-based mode picker (deferred to month 2)
- No error tracking (Sentry, LogRocket, etc.) in MVP
- No mobile native app
- No OCR for handwriting / cursive
- No physical-certificate-to-digital conversion
- No custom user-defined redaction rules
- No team dashboards or multi-user accounts

---

## 2. Tech Stack

| Layer            | Technology                     | Justification                                                |
|------------------|--------------------------------|--------------------------------------------------------------|
| Frontend         | Next.js 14 (App Router, static export) | SEO-capable; static hosting compatible                 |
| Hosting          | **Cloudflare Pages** (free tier) | Same-origin analytics; free; India edge                   |
| Analytics        | **Cloudflare Web Analytics**   | Free, no cookies, no third-party outbound request            |
| OCR              | Tesseract.js (English only, WASM) | Client-side; no external API calls                        |
| Face detection   | face-api.js (WASM)             | Lazy-loaded; tiny-face-detector model (~200KB)               |
| QR detection     | zxing-wasm                     | Client-side multi-format decoder                             |
| PDF read         | pdf.js                         | Rasterize every page to canvas                               |
| PDF write        | pdf-lib                        | Build output as image-only PDF                               |
| Image processing | Canvas API + custom preprocess | Deskew, contrast boost, denoise                              |
| Email routing    | Cloudflare Email Routing       | Free — `hello@docredact.in` → personal inbox                 |
| Email contact form| Cloudflare Worker + Resend free tier | For B2B API waitlist + contact form                   |
| Domain           | `docredact.in` (Namecheap or similar) | ~₹600/year                                             |

### 2.1 Cost at MVP

- Domain: ~₹600/year
- Everything else: ₹0/month (free tiers only)
- Client-side compute is the user's device — zero infrastructure cost scales infinitely

### 2.2 Explicitly Rejected

- **Server-side OCR** (Google Vision, AWS Textract, on-prem Tesseract) — violates privacy thesis
- **Any backend that touches file bytes** — eliminates entire class of liability
- **Cloud PDF libraries** (Nutrient, PSPDFKit cloud, PDF.co) — same reason
- **Vercel hosting** — replaced by Cloudflare Pages to keep analytics same-origin
- **Plausible, Google Analytics, Mixpanel** — Cloudflare Web Analytics satisfies requirements without third-party outbound request or cost
- **Sentry, LogRocket, Datadog RUM** — would capture document metadata via exception payloads
- **User accounts in v1** — adds complexity, not value for consumer tier
- **PWA / service worker in v1** — deferred post-launch
- **Multiple SEO landing pages in v1** — start with 1 flagship, validate SEO thesis before writing more

---

## 3. System Architecture

### 3.1 Architecture Diagram

```
+---------------------------------------------+
|  User's Browser Tab                         |
|                                             |
|  +-------------------------------------+    |
|  |  Next.js static SPA                 |    |
|  |                                     |    |
|  |  1. File drop / mobile camera       |    |
|  |  2. PDF/Image parser                |    |
|  |  3. Preprocess (deskew, contrast)   |    |
|  |  4. Detection pipeline              |    |
|  |     ├─ Tesseract.js OCR (English)   |    |
|  |     ├─ Aadhaar regex + Verhoeff     |    |
|  |     ├─ PAN regex + entity-code check|    |
|  |     ├─ Passport MRZ regex           |    |
|  |     ├─ face-api.js (faces)          |    |
|  |     └─ zxing-wasm (QR)              |    |
|  |  5. Detection toggle list (verify)  |    |
|  |  6. Canvas masking render           |    |
|  |  7. PDF flatten (rasterize all pages)|   |
|  |  8. Download blob                   |    |
|  +-------------------------------------+    |
|                                             |
+-------------------+-------------------------+
                    |
                    | (only non-document traffic)
                    v
+---------------------------------------------+
|  Cloudflare Pages (same origin)             |
|  - HTML/CSS/JS bundle                       |
|  - WASM binaries (Tesseract, face-api, zxing) |
|  - SEO landing page                         |
|  - Cloudflare Web Analytics (same origin)   |
|  - Cloudflare Worker (waitlist + contact)   |
+---------------------------------------------+
```

### 3.2 Critical Invariant

**Zero outbound document-content requests during the redaction flow.** From file-drop/capture to download, the Network tab shows zero requests carrying document data (analytics beacons to Cloudflare's edge are same-origin and document-content-free). This is the entire trust proposition and is enforced in CI via a Playwright test (`tests/e2e/no-outbound-network.spec.ts`).

### 3.3 Core User Flow

1. User lands on `/` (root redactor) or `/mask-aadhaar-online` (flagship SEO page)
2. **Mobile:** primary CTA is "📷 Take Photo"; secondary is file upload. **Desktop:** file drop-zone is primary
3. File/photo is read into an `ArrayBuffer` via `FileReader` / `<input capture>` — never sent to network
4. Preprocessing pipeline runs on canvas elements (deskew, contrast normalization)
5. Detection pipeline runs in sequence (OCR → regex → face → QR)
6. **Multi-page PDFs:** detection runs on all pages upfront (progress bar); preview shows page 1 with prev/next navigation
7. User sees a preview with each detected region highlighted and a toggle list of all detections
8. User can toggle individual detections OFF (e.g., "don't mask the face because landlord needs to verify it's me"). By default everything is toggled ON
9. User clicks "Download redacted PDF" → PDF is flattened (all pages rasterized to images, text layer discarded) → blob generated locally → triggered via `<a download>` with filename `[original]_redacted.pdf`
10. Session state is discarded on page unload (no `localStorage`/`sessionStorage` of document content)

---

## 4. Detection Pipeline — Detailed Design

### 4.1 Orchestration

Single Web Worker orchestrates the pipeline to keep the UI thread responsive. Heavy steps (Tesseract, face-api) run in their own Workers where supported. Fallback to main thread on iOS Safari where `OffscreenCanvas` or nested Workers are flaky.

```
MainThread → DetectionOrchestrator (Worker)
                ├─ ImagePreprocessor
                ├─ OCRRunner (Tesseract Worker, English only)
                ├─ AadhaarDetector
                ├─ PanDetector
                ├─ PassportMrzDetector
                ├─ FaceDetector (face-api Worker)
                ├─ QrDetector (zxing Worker)
                └─ RegionMerger
```

### 4.2 Image Preprocessing

Real-world Indian Aadhaar photos are frequently: skewed 5–30°, glare-affected, low-contrast, colored background. Default Tesseract.js accuracy on raw input: **60–75%**. Required accuracy to avoid wrong-digit masking: **95%+**.

Preprocessing steps (in order):
1. **Downscale** to max 2400px on longer edge (Tesseract accuracy peaks here, speed doubles)
2. **Grayscale** conversion (ITU-R BT.601 weights)
3. **Deskew** using Hough transform on edge-detected image (rough ±20° correction)
4. **Contrast normalization** via CLAHE (Contrast Limited Adaptive Histogram Equalization)
5. **Denoise** via 3×3 Gaussian blur (σ=0.5)
6. **Binarization** via Otsu's method for OCR input

Face detection runs on the original RGB image, not the preprocessed one.

### 4.3 Aadhaar Detector

**Format:** 12 digits, typically printed as `XXXX XXXX XXXX` (space-separated groups of 4). Latin digits regardless of the card's primary regional language — so English-only Tesseract is sufficient.

**Detection flow:**
1. OCR output text is scanned for `\d{4}[\s-]?\d{4}[\s-]?\d{4}` pattern
2. Each 12-digit candidate is validated via **Verhoeff checksum** (UIDAI official validation)
3. Only Verhoeff-valid candidates are surfaced
4. Bounding box is derived from Tesseract word-level coordinates (union of the three 4-digit tokens)
5. Masking target: **first 8 digits** (UIDAI-recommended masking pattern); last 4 remain visible

**Why Verhoeff is non-negotiable:** a naive 12-digit regex matches phone-number-prefixed strings, old account numbers, order IDs, and garbled OCR from non-English text zones. Masking the wrong 12 digits while leaving the actual Aadhaar visible is a worse failure than not detecting at all. Verhoeff ≥99.9% reduces false positives to near-zero.

### 4.4 PAN Detector

**Format:** 10 characters — `[A-Z]{5}[0-9]{4}[A-Z]`.

**Detection flow:**
1. OCR output scanned for strict regex match
2. 4th character validated as one of the PAN entity-type codes (P/F/C/H/A/T/B/L/J/G) — rejects false positives
3. Full PAN masked (no "show last 4" convention for PAN)

### 4.5 Passport MRZ Detector

**Format:** Machine Readable Zone on Indian passport, 2 lines × 44 chars each, OCR-B font.

**Detection flow:**
1. OCR run with Tesseract in `--psm 6` + `-c tessedit_char_whitelist=0-9A-Z<` mode for MRZ-only pass (second OCR pass on cropped region candidates)
2. Regex match on line structure:
   - Line 1: `P<IND[A-Z<]+` (document type + issuing country + name)
   - Line 2: `[A-Z0-9<]{9}\dIND\d{6}\d[MF<]\d{6}\d[A-Z0-9<]{14}\d\d` (passport number + nationality + DOB + sex + expiry + personal ID + check)
3. Both lines masked as a single block

### 4.6 Face Detection

face-api.js TinyFaceDetector model (~200KB, loaded lazily on first image with likely face content).

**Flow:**
1. Run on original RGB image
2. Detections with confidence < 0.6 discarded
3. Bounding box expanded by 15% (ensure hair + ears are covered on passport photos)
4. Applied mask: **solid black rectangle** — originally specified as σ=30 Gaussian blur; revised after smoke testing revealed the blur left recognizable face shape and skin-tone cues, which known-σ deblurring and face super-resolution (PULSE/GFPGAN/CodeFormer class) can exploit. Solid fill is irreversible by construction.
5. User toggle per detection: some scenarios legitimately need the face visible (e.g., landlord verification)

### 4.7 UIDAI QR Detector

UIDAI Aadhaar cards have a secure QR containing encrypted demographic data. Presence detection is sufficient; no decryption attempted.

**Flow:**
1. zxing-wasm scans for QR codes across the document
2. Any QR with payload prefix indicative of UIDAI format (contains `<PrintLetterBarcodeData`) → flagged as UIDAI QR
3. Masked with solid black rectangle + 5px padding
4. Other QRs (random QRs on mail envelopes, etc.) → surfaced but NOT auto-masked by default; user can toggle ON

### 4.8 Region Merger

Overlapping detections are merged via IoU threshold 0.3. Final mask layer is flattened before PDF re-embed.

---

## 5. Masking & PDF Re-embed

### 5.1 Mask Styles (Fixed, No User Choice)

| Detection | Mask style | Reasoning |
|-----------|-----------|-----------|
| Aadhaar first 8 digits | Solid black rectangle | Industry standard (UIDAI's own masked Aadhaar uses this) |
| Full PAN | Solid black rectangle | Consistency |
| Passport MRZ | Solid black rectangle | Standard |
| UIDAI QR | Solid black rectangle | Blurred QRs can still be decoded; solid only |
| Face | Solid black rectangle (expanded 15%) | Originally σ=30 blur; revised because blur is reversible (known-σ deblurring + face super-resolution). Solid fill is irreversible by construction. |

### 5.2 Image Output Path

1. Create a canvas matching source dimensions
2. Draw source image
3. For each masked region, draw a filled black rectangle (all PII types)
4. Export as JPEG (quality 0.85) or PNG

### 5.3 PDF Output Path — Flatten-First (Universal)

**Decision: every output PDF is flattened to an image-only PDF.** This guarantees no `pdftotext` extraction of visually-redacted content.

Flow for all PDFs (regardless of whether input was native-text or scanned):

1. Use **pdf.js** to rasterize each page to a canvas at 2× source resolution
2. Apply masking on the canvas (same as image output path)
3. Use **pdf-lib** to build a new PDF where each page is the masked canvas embedded as JPEG
4. Preserve original page dimensions
5. Original text layer, hidden annotations, metadata all discarded

**Trade-off accepted:** output PDF is 2–5× larger than input; Ctrl+F search no longer works in the output. Communicated to user in disclaimer text below download button: *"Output is image-only PDF to prevent text extraction of redacted content. Larger file size; no searchable text."*

---

## 6. Trust & Privacy Architecture

### 6.1 Architectural Commitments

- All file processing happens in the browser tab. No document bytes, OCR output, detection coordinates, or metadata are transmitted anywhere.
- **Cloudflare Web Analytics** is same-origin (served from Cloudflare Pages edge). No third-party outbound during redaction flow. No cookies. No PII capture.
- No error-tracking services (Sentry, Datadog RUM, etc.) in MVP — they can exfiltrate document metadata via unhandled exceptions.
- CSP header prohibits outbound connections except to the same origin (see §13.1).
- **Repository is fully open-source under AGPL-3.0.** Users can read every line of detection and rendering code.

### 6.2 Verifiable Trust Mechanisms

1. **CSP header** locked to same origin (reviewable by user in DevTools)
2. **Network tab stays silent** during redaction flow — testable by user, enforced in CI via Playwright (`page.on('request')` asserts no document-data requests)
3. **Public GitHub repo** with complete source, including detection pipeline, preprocessing, masking, and PDF rewriter. Commit history preserved (no squashes, no force-pushes on `main`).
4. **Prominent "Verify for yourself" section** on landing page linking to GitHub and to a `/how-it-works` explainer
5. **Cloudflare Web Analytics disclosure** — what it captures (page view counts, referrers, country-level geo) and what it does not (cookies, IPs, fingerprinting, document data)

### 6.3 Threat Model — What We Do Protect Against

- Our team accidentally seeing user documents → impossible by design (never transit our infra)
- Competitors incorporating our code into closed-source SaaS without reciprocation → AGPL deters
- Analytics leaking document metadata → Cloudflare Web Analytics doesn't capture event data; only page views

### 6.4 Threat Model — Out of Scope

- User's browser compromised by malware
- User screenshots the preview before redaction
- User uploads same file to another service after redacting
- Adversary MITMs Cloudflare's JS bundle — mitigated by HTTPS + subresource integrity

---

## 7. Performance Targets

| Metric                               | Target                                |
|--------------------------------------|---------------------------------------|
| Time to Interactive (desktop)        | < 2.5s                                |
| Time to Interactive (3G mobile)      | < 6s                                  |
| Initial JS bundle size               | < 150KB gzipped (excludes WASM)       |
| OCR accuracy on clean Aadhaar scan   | > 95%                                 |
| OCR accuracy on phone-photographed Aadhaar | > 85% (stretch: 90%)            |
| Verhoeff false-positive rate         | < 0.1%                                |
| End-to-end redaction time (1MB image)| < 8s desktop, < 15s mid-range Android |
| End-to-end redaction time (5MB PDF)  | < 20s desktop, < 40s mid-range Android|

### 7.1 Performance Strategy

- Lazy-load Tesseract.js WASM (4MB) only after first file drop / camera capture
- Lazy-load face-api.js model only if a face-likely document detected
- Pre-warm Tesseract worker on file-drop hover
- Use `OffscreenCanvas` in Workers where supported (Chrome, Samsung, Firefox); main-thread fallback on iOS Safari
- Tailwind CSS only (no runtime CSS-in-JS)

---

## 8. Mobile-First UX

The primary target audience (per market research) is Indian mobile users, particularly Android. Desktop is secondary.

### 8.1 Layout

- **Mobile (< 768px):** primary hero CTA is a large "📷 Take Photo" button using `<input type="file" accept="image/*" capture="environment">`. Secondary CTA is "Upload file" for gallery/document picker. File drop-zone is hidden or minimized below the fold.
- **Desktop (≥ 768px):** primary CTA is a large drag-and-drop zone with file picker. No camera button (most desktops have poor webcams and it's not the use case).

### 8.2 Camera Flow

1. User taps "Take Photo" → OS camera opens
2. User photographs Aadhaar/PAN/etc.
3. Browser returns the captured image directly to the app
4. Detection pipeline runs immediately (no intermediate "preview the photo" step — straight into detection preview)
5. User reviews detections, toggles, downloads

### 8.3 Mobile Performance Notes

- Camera-captured images from modern Android phones are 8–15MB (large sensor + HDR). The 20MB ceiling accommodates these.
- Pre-warm Tesseract worker when user taps "Take Photo" button — by the time the photo is captured, the WASM is loaded
- On Android, show a spinner with concrete progress text ("OCR scanning… 40%") — Indian mobile users abandon silent spinners quickly

---

## 9. Browser Support

### 9.1 Supported (MVP target)

- Chrome (latest 2 versions, Android + desktop)
- Safari iOS (latest 2 versions — with fallback paths for `OffscreenCanvas` limitations)
- Samsung Internet (latest 2 versions)
- Firefox (latest 2 versions)
- Edge (latest 2 versions)

### 9.2 Unsupported (show friendly page)

- UC Browser / Opera Mini / any browser without WASM support
- Browsers older than 2023

### 9.3 Unsupported-Browser Page

Clean page at `/unsupported-browser`:
- "DocRedact.in needs a modern browser to redact documents locally on your device"
- "Try using Chrome, Firefox, or Safari"
- Links to Chrome for Android / iOS Safari instructions

### 9.4 iOS Safari Notes

iOS Safari's `OffscreenCanvas` support is partial; face-api.js runs 3–5× slower than Chrome. Acceptable for MVP. No iOS-specific polish invested until post-launch analytics show iOS traffic is significant.

---

## 10. Landing Pages & SEO (MVP = 1 Flagship Page)

### 10.1 MVP Launch Pages

| URL                          | Purpose                                      |
|------------------------------|----------------------------------------------|
| `/`                          | Root redactor — generic, all detectors active |
| `/mask-aadhaar-online`       | **Flagship SEO page** — ~2,000 words, deep, with live tool embedded |
| `/privacy`                   | Plain-English privacy policy                 |
| `/terms`                     | Terms of Service with liability disclaimer   |
| `/how-it-works`              | Trust explainer + architecture diagram + GitHub link |
| `/api-waitlist`              | B2B API form (email + company + use case)    |
| `/contact`                   | Contact form (forwards to `hello@docredact.in`) |
| `/unsupported-browser`       | Shown to WASM-incapable browsers             |

### 10.2 Flagship Page Structure (`/mask-aadhaar-online`)

- Above the fold: H1 + live drop-zone / Take Photo CTA
- Why mask Aadhaar (RBI + UIDAI + DPDP context, ~400 words)
- How our tool works (architecture, 3-step process, ~400 words)
- Why privacy matters here (radical transparency language, ~400 words)
- FAQ (10 questions with schema.org FAQPage markup, ~500 words)
- "Verify for yourself" section linking to GitHub repo
- Footer with links to `/privacy`, `/terms`, `/how-it-works`, `/contact`

### 10.3 Post-MVP SEO Expansion (Month 2+)

Based on Google Search Console data from the flagship page:

- `/redact-pan-card` — if PAN-related queries show up in GSC
- `/hide-aadhaar-number-pdf` — if PDF-specific queries rank
- `/mask-passport-india` — if passport traffic emerges

Only add pages that real search data justifies.

---

## 11. Project Structure

```
doc-redact-in/
├── LICENSE                              (AGPL-3.0 full text)
├── README.md
├── RFC.md
├── CLAUDE.md
├── CONTRIBUTING.md
├── app/
│   ├── page.tsx                         (root redactor)
│   ├── mask-aadhaar-online/page.tsx     (flagship SEO page)
│   ├── privacy/page.tsx
│   ├── terms/page.tsx
│   ├── how-it-works/page.tsx
│   ├── api-waitlist/page.tsx
│   ├── contact/page.tsx
│   └── unsupported-browser/page.tsx
├── src/
│   ├── detection/
│   │   ├── DetectionOrchestrator.ts
│   │   ├── ImagePreprocessor.ts
│   │   ├── AadhaarDetector.ts
│   │   ├── Verhoeff.ts
│   │   ├── PanDetector.ts
│   │   ├── PassportMrzDetector.ts
│   │   ├── FaceDetector.ts
│   │   ├── QrDetector.ts
│   │   └── RegionMerger.ts
│   ├── masking/
│   │   ├── CanvasMaskRenderer.ts
│   │   └── PdfFlattener.ts              (rasterize all pages → image-only PDF)
│   ├── pdf/
│   │   ├── PdfLoader.ts
│   │   └── PdfPageRasterizer.ts
│   ├── workers/
│   │   ├── ocr.worker.ts
│   │   ├── face.worker.ts
│   │   └── qr.worker.ts
│   └── ui/
│       ├── MobileCameraCapture.tsx
│       ├── DropZone.tsx
│       ├── PreviewCanvas.tsx
│       ├── PageNavigator.tsx            (prev/next for multi-page PDFs)
│       ├── DetectionToggleList.tsx
│       └── DownloadButton.tsx
├── public/
│   ├── models/                          (face-api model weights)
│   └── wasm/                            (tesseract eng language data, zxing)
├── tests/
│   ├── detection/
│   │   ├── Verhoeff.test.ts             (UIDAI 200-vector pass)
│   │   ├── AadhaarDetector.test.ts
│   │   ├── PanDetector.test.ts
│   │   └── PassportMrzDetector.test.ts
│   ├── fixtures/                        (sample docs, synthetic — NOT real PII)
│   └── e2e/
│       ├── redaction-flow.spec.ts
│       ├── flatten-pdf.spec.ts
│       └── no-outbound-network.spec.ts  (critical CI invariant)
└── workers/                             (Cloudflare Worker handlers)
    ├── waitlist.ts
    └── contact.ts
```

---

## 12. MVP Milestones

### 12.1 Build Phase (5 weekends)

| Weekend | Milestone                        | Deliverable                                                    |
|---------|----------------------------------|----------------------------------------------------------------|
| **W1**  | Detection core                   | Next.js scaffold, file drop, Tesseract integration (English), Aadhaar detector with Verhoeff validation, PAN detector, test harness, AGPL license file |
| **W2**  | PDF in/out + flatten             | pdf.js rasterization, pdf-lib flattener, image preprocessing pipeline, canvas masking, download flow with `_redacted.pdf` naming |
| **W3**  | Face + QR + MRZ + mobile camera  | face-api.js lazy-load + Gaussian blur, zxing-wasm QR detection, passport MRZ detector, mobile camera-capture flow with hero CTA |
| **W4**  | Trust UX + flagship page + infra | Flagship `/mask-aadhaar-online` (~2,000 words), root page, `/how-it-works`, `/privacy` (plain-English), `/terms`, `/how-it-works`, CSP lockdown, Cloudflare Web Analytics wired, `/api-waitlist`, `/contact`, Cloudflare Email Routing (`hello@docredact.in`), no-outbound-network CI test, domain registered & pointed |
| **W5**  | Polish + soft launch             | Detection toggle UI polish, multi-page preview with prev/next, unsupported-browser page, iOS Safari smoke test, GitHub repo public, AGPL headers on source files, soft launch on r/developersIndia |

### 12.2 Launch Phase (3 weeks, sequenced)

| Week        | Channel                                  | Goal                                                  |
|-------------|------------------------------------------|-------------------------------------------------------|
| **Launch W1** | r/developersIndia (soft)               | Find bugs with a forgiving technical audience; iterate fixes |
| **Launch W2** | Show HN                                | Polished technical launch after W1 fixes              |
| **Launch W3** | Product Hunt India + r/india + r/indianews | Broader consumer reach after HN validation      |

### 12.3 Post-MVP Sequencing (Not in scope)

- **Month 2:** Add `/redact-pan-card` and `/hide-aadhaar-number-pdf` based on GSC data; scenario presets based on user toggle patterns
- **Month 3:** WhatsApp bot integration (Cloudflare Worker, deletes file after processing); PWA/offline mode if install intent emerges
- **Month 3–4:** B2B API tier — first paying customer target
- **Month 4–6:** Chrome extension version; voter ID / driving licence detectors
- **Month 6+:** Public security audit (~₹50K budget) + sister-site launch (DocSplit.in or KYCSafe.in)

---

## 13. Security & Compliance

### 13.1 CSP (Content Security Policy)

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval' static.cloudflareinsights.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  connect-src 'self' cloudflareinsights.com;
  worker-src 'self' blob:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
```

### 13.2 Subresource Integrity

All JS/WASM bundles served from Cloudflare Pages origin. No third-party CDN for WASM files. SRI hashes in production build.

### 13.3 DPDP Act Framing

Product is NOT a Data Fiduciary for user documents — we never receive document data. Document contents do not traverse our infrastructure. We are out of DPDP scope for document data.

We ARE a Data Fiduciary for:
- B2B waitlist form (email + company + use case) — stored in Cloudflare Worker KV
- Contact form submissions (email + message) — forwarded via Resend
- Cloudflare Web Analytics (page view counts — no PII)

Privacy policy (§14) discloses these in plain English.

### 13.4 Liability Disclaimers (in ToS and on Download Button)

- Tool provides best-effort detection; user verifies output before sharing
- No warranty of completeness (small fonts, rotated text, unusual layouts may be missed)
- User is responsible for the final redacted document
- Tool does not substitute for UIDAI-issued masked Aadhaar where regulatorily required
- Output PDF is image-only; no searchable text layer

### 13.5 Clipboard & Storage Hygiene

- `navigator.clipboard` never programmatically read
- Dropped files never retained across page navigation
- No `localStorage` / `sessionStorage` writes of document content
- EXIF data stripped on image load (canvas re-export discards it)

---

## 14. Privacy Policy (Plain-English Draft)

To be rendered at `/privacy`. Approximate final copy:

> **The short version: we don't see your documents.**
>
> DocRedact.in processes your file entirely in your browser tab. It never leaves your device. We have no servers that touch your document, no database that stores it, no API that analyzes it. If you disconnect from the internet after loading this page, the tool still works — because everything runs locally.
>
> **What we do collect:**
>
> - **Page view counts** via Cloudflare Web Analytics. This tells us which pages are visited, from which country (state-level at most), and from which referring site. No cookies. No IP addresses stored. No fingerprints. No ability to identify you.
> - **If you use the B2B API waitlist form:** your email, company name, and use case selection. Stored in Cloudflare Workers KV. We use it only to contact you about the API.
> - **If you use the contact form:** your email and message. Forwarded to our inbox. We keep it as long as needed to respond to you.
>
> **What we never collect:**
>
> - Your documents, or any part of them
> - OCR text extracted from your documents
> - Detection coordinates, filenames, or file sizes of what you redact
> - Cookies. Tracking pixels. Third-party trackers. Session replay.
>
> **Verify it yourself:**
>
> Our full code is public on GitHub under AGPL-3.0: [link]. The "no network calls during redaction" property is tested in CI. Open your browser's DevTools, go to the Network tab, and watch — you'll see no requests leave your machine while you redact.
>
> **Your rights:**
>
> You can request deletion of any contact or waitlist data at any time by emailing hello@docredact.in.
>
> **Last updated:** [date]. Changes announced in the GitHub repo commit history.

---

## 15. Contact & Support

### 15.1 Channels

- **GitHub Issues** — `github.com/shadabkhan/doc-redact-in/issues` for bugs, feature requests, questions. Public, structured. Preferred for technical users.
- **Email** — `hello@docredact.in` via Cloudflare Email Routing (free), forwards to personal inbox. Private channel for non-technical users or sensitive feedback.

### 15.2 Response SLA

- No formal SLA; best-effort response within 3–7 days
- Critical bugs (detection failures, security issues) prioritized — aim for same-week fix

### 15.3 Open Source Contribution

AGPL-3.0 project. External contributions welcome via Pull Requests. No CLA required for v1 (solo maintainer). If meaningful contributions accumulate, will add a lightweight CLA to simplify future relicensing flexibility.

---

## 16. Validation Gates (Pre-Build)

Before Weekend 1:

1. **Tesseract accuracy spike (2 hours)** — run Tesseract.js English-only against 20 real Aadhaar photos (own + family, with consent). If raw accuracy < 60% and preprocessed accuracy projections don't close the gap to 85%+, rethink detector approach.
2. **Verhoeff validation reference** — hand-code and test Verhoeff against UIDAI's published 200-entry test vector. 100% pass required before Weekend 1 proceeds.
3. **Competitor spot-check** — upload same 5 test documents to iLovePDF, Smallpdf, Adobe Online. Confirm none auto-detect Indian-specific PII. Document the gap.
4. **SEO keyword volume** — pull Google Search Console estimates for the 5 target keywords via Keywords Everywhere / Ubersuggest. Proceed only if "mask aadhaar online" + "aadhaar masking tool" combined volume > 5K/month India.
5. **CSP feasibility** — confirm Tesseract.js, face-api.js, pdf.js, zxing-wasm all work under strict CSP with `wasm-unsafe-eval` only. Prototype a minimal page.
6. **Cloudflare Pages + Next.js compatibility** — verify Next.js 14 static export deploys cleanly to Cloudflare Pages. Smoke test.
7. **Domain availability** — confirm `docredact.in` is available; if taken, decide rename before Weekend 1.

---

## 17. Post-MVP — B2B API Design (Sketch Only)

**Not in MVP scope. Sketched here so MVP decisions don't paint us into a corner.**

### 17.1 API Shape (future)

```
POST /v1/redact
Headers: Authorization: Bearer <api_key>
Body: multipart/form-data
  file: <document>
  options: { detect: ["aadhaar", "pan", "face", "qr", "mrz"], outputFormat: "pdf" }

Response: application/pdf (the flattened, redacted document)
Response headers:
  X-Detections: aadhaar=1,pan=0,face=1,qr=1,mrz=0
  X-Processing-Time-Ms: 1234
```

### 17.2 Server Architecture (future)

- Kotlin + Spring Boot OR Node worker on Cloudflare Workers
- Runs the SAME detection pipeline (share code via npm package exported from the client repo)
- Headless Chromium for PDF rasterization where needed
- Zero document logging; only metadata (size, duration, detection counts)
- Deployed in India region (Fly.io BOM or AWS ap-south-1)

### 17.3 Pricing (future)

- Starter: ₹5,000/mo — 10,000 redactions
- Growth: ₹25,000/mo — 100,000 redactions
- Enterprise: ₹1L+/mo — custom SLA, VPC peering, on-prem option

---

## 18. Open Questions (Remaining After Clarifying Review)

- [ ] Detection confidence surfacing: show users a confidence score per detection, or keep it binary? (Lean: binary for MVP; add confidence in month 2 if support requests demand it)
- [ ] Tesseract language data size optimization: ship only digits-tuned English model (~2MB vs default 4MB)?
- [ ] Open-source CLA — defer until external contributions materialize
- [ ] Launch day timing within each week — weekday vs weekend posting for maximum Reddit / HN / PH reach?
- [ ] Whether to pre-publish a "launch announcement" blog post or let the product speak for itself at Show HN
