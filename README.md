# DocRedact.in

Client-side, mobile-first, open-source web tool for redacting Aadhaar, PAN, passport, and other Indian ID documents. Everything runs in the browser — no file ever touches the server.

**Status:** Consumer tool with automatic detection, manual redaction and image-only PDF export. Browser-side business integration is planned, not currently available. Licensed under AGPL-3.0-or-later.

## Verify the privacy claim yourself

The whole pitch is "nothing leaves your device." The way to check that:

1. Open this site in any browser, open DevTools → Network tab.
2. Drop a file or take a photo of an Indian ID document.
3. Watch the detection + download flow.
4. Confirm you see no request carrying your document leave the tab. Static software and model assets are downloaded from this site. If analytics is enabled, Cloudflare's external script and page-usage endpoint also use the network without receiving document data.

`tests/e2e/no-outbound-network.spec.ts` checks allowed requests during successful image/PDF detection, manual editing and downloads. It rejects same-origin uploads and unexpected query parameters as well as cross-origin requests. Tests use synthetic fixtures and are regression checks, not proof for every possible input. The production test command disables optional analytics and applies the exported site's CSP.

First use needs a network connection to load lazy assets. Offline use depends on those assets remaining available in the browser cache; loading the page alone is not enough.

## Quickstart

```sh
npm install
npm run dev
npm test
npm run test:e2e
npm run test:e2e:production
npm run build
```

Node ≥ 20.

### Private local-sample regression

After building with optional analytics disabled, run the production browser checks against your own local directory:

```sh
env -u NEXT_PUBLIC_CF_ANALYTICS_TOKEN npm run build
RUN_LOCAL_SAMPLES=1 LOCAL_SAMPLE_DIR=/path/to/private/samples E2E_PRODUCTION=1 npx playwright test tests/e2e/local-samples.spec.ts --workers=1 --reporter=line
```

The test covers processing, page review, PDF download and request privacy in Chromium and WebKit. Screenshots, videos and traces are disabled for these tests. Logs contain filenames and detection counts, not document contents or detected values. Downloads are read in memory; do not commit real documents or generated PDFs. A successful file test confirms compatibility, not complete detection accuracy; the logged Aadhaar counts flag samples needing manual review. A physical phone test is still needed for mobile memory behavior.

## Pre-launch checklist (manual steps outside this repo)

- [ ] Register `docredact.in` (~₹600/yr).
- [ ] Create a Cloudflare Pages project and connect this repo; deploy the `out/` directory.
- [ ] Generate `public/og.png` (1200×630 PNG from `public/og.svg`) — Twitter/LinkedIn/WhatsApp do not render SVG OG images.
- [ ] Enable Cloudflare Web Analytics; set `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` as a Pages env var.
- [ ] Set up Cloudflare Email Routing for `hello@docredact.in`.
- [ ] Deploy `workers/waitlist.ts` via `wrangler`; bind `WAITLIST_KV`; route `/api/waitlist` to it; set `ALLOWED_ORIGINS=https://docredact.in,https://www.docredact.in`.
- [ ] Run the real-world Tesseract accuracy spike on 20 Aadhaar photos (Validation Gate #1 per RFC §16).
- [ ] Verify on a physical iOS Safari device (RFC §9.4).

## What it does

Drop an image or PDF — or tap "Take Photo" on mobile — then auto-detect Aadhaar number, PAN, passport MRZ, UIDAI QR, photograph → mask first 8 Aadhaar digits, cover the face photo with a black rectangle, redact QR → download a clean **image-only PDF** (no searchable text layer, so masked content can't be extracted with `pdftotext`).

**Limits:** JPG, PNG, WebP and PDF, up to 20 MB and 10 PDF pages. A page can contain at most 40 million rasterized pixels; the document budget is 80 million pixels. These budgets give approximately 40% pixel headroom over the largest PDF in the local regression set (about 28.5 million per page and 57 million total at 3×). They are compatibility guards, not verified safe-memory limits for budget phones. Large images may need resizing, and PDFs may need splitting. PDF pixel limits apply after rasterization (3× for automatic detection, 2× for manual mode). Limits are defined in `src/documents/limits.ts`.

Transparent selections show the exported mask boundaries. Exports paint solid masks onto temporary canvases, leaving the original file and editable session unchanged. Review every page and the downloaded result. This is a locally redacted copy, not an official UIDAI-issued masked Aadhaar.

## Why it exists

- Reduce the personal details disclosed when sharing an existing identity document.
- Keep document processing on the user's device instead of uploading to an online editor.
- Make the privacy architecture inspectable through open source and browser network tools.
- Offer manual corrections when automatic detection misses content.

Check the recipient's requirements before sharing a redacted copy. For an official Aadhaar download, use UIDAI's portal.

## Non-goals (deliberately)

- Not a KYC verification service — only redaction
- Not a storage service — files never leave the browser
- Not a tax/legal advisory product
- No accounts / logins in v1
- No PWA / offline mode in v1
- No batch processing or API in v1 (B2B API tier is post-MVP)
- No scenario presets in v1 (auto-detect everything; user toggles off)
- No regional language OCR (English only; Verhoeff checksum filters false positives)

## Primary segments

- **Consumer (free, always):** individuals sending Aadhaar/PAN to employers, landlords, platforms, especially on mobile
- **B2B integration (planned):** browser-side redaction before a user's document reaches a business application; no server-side document processing is offered.

## Tech stack

All client-side, zero server compute for the redaction flow:

- **Frontend:** Next.js 14 (App Router, static export)
- **Hosting:** Cloudflare Pages (free tier, India edge)
- **Analytics:** Cloudflare Web Analytics (optional external script and collection endpoint; no document data)
- **Email:** Cloudflare Email Routing (`hello@docredact.in` → personal inbox)
- **OCR:** Tesseract.js (English only, WASM)
- **Face detection:** MediaPipe BlazeFace (short- and full-range models, WASM, lazy-loaded)
- **QR detection:** zxing-wasm
- **PDF read:** pdf.js (rasterize every page)
- **PDF write:** pdf-lib (build image-only flattened PDF)
- **Payments (post-MVP):** Razorpay for B2B API tier

Cost at MVP: ~₹600/year (domain only). Everything else on free tiers.

## MVP scope

**Build phase (5 weekends):**
- **W1:** Detection core — Tesseract + Aadhaar detector with Verhoeff + PAN detector
- **W2:** PDF flatten pipeline (rasterize → mask → image-only PDF) + download flow
- **W3:** Solid face masks + UIDAI QR + passport MRZ + mobile camera-capture hero CTA
- **W4:** Flagship SEO page (`/mask-aadhaar-online`) + privacy + terms + how-it-works + CSP lockdown + waitlist + contact + domain + analytics
- **W5:** Polish + multi-page preview + GitHub repo public + AGPL headers

**Launch phase:**
Gradual rollout across developer and consumer communities, iterating on feedback between each step.

Deliberate v1 omissions: no Pro tier, no batch, no accounts, no payments, no API, no PWA, no regional languages, no scenario presets. Consumer is 100% free. Revenue arrives via B2B conversations in month 3+.

## Design docs

- [`RFC.md`](RFC.md) — technical design, detection pipeline, architecture, milestones, locked decisions

## Kill criteria

- 90-day organic traffic < 5K visits on `/mask-aadhaar-online` → keyword demand over-estimated
- 6 months live, zero inbound from HR tech / fintech for the B2B API waitlist → B2B upgrade path isn't real
- Major incumbent (iLovePDF / Smallpdf / Adobe) ships India-specific auto-detect for free → consumer differentiation gone

## License

DocRedact.in is licensed under the [GNU Affero General Public License v3.0](LICENSE).

## Contact

- Bugs / features: [GitHub Issues](https://github.com/shadab127/doc-redact-in/issues)
- Private feedback: `hello@docredact.in`
