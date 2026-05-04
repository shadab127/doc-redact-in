# DocRedact.in

Client-side, mobile-first, open-source web tool for redacting Aadhaar, PAN, passport, and other Indian ID documents. Everything runs in the browser — no file ever touches the server.

**Status:** MVP built (W1–W5 of RFC v2). Full unit-test coverage on detectors, masking, forms, and UI. Next step: domain registration + Cloudflare Pages deploy + public launch. Licensed under AGPL-3.0-or-later.

## Verify the privacy claim yourself

The whole pitch is "nothing leaves your device." The way to check that:

1. Open this site in any browser, open DevTools → Network tab.
2. Drop a file or take a photo of an Indian ID document.
3. Watch the detection + download flow.
4. Confirm you see no request carrying your document leave the tab. The only network traffic during redaction should be the same-origin static assets and lazy WebAssembly fetches.

This property is enforced in CI — `tests/e2e/no-outbound-network.spec.ts` fails the build if any cross-origin request fires during redaction.

## Quickstart

```sh
npm install
npm run dev       # http://localhost:3000
npm test          # 127 unit tests (vitest)
npm run test:e2e  # Playwright: smoke + no-outbound-network
npm run build     # Static export → ./out (Cloudflare Pages target)
```

Node ≥ 20.

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

**Positioning:** "UIDAI's masked-Aadhaar download is a 5-step OTP portal. This is one tap on your phone, free, nothing uploaded, and the code is public."

## Why it exists

- RBI + UIDAI circulars require masked Aadhaar for KYC sharing
- DPDP Act (rules notified Nov 2025) adds fiduciary liability for mishandled PII
- UIDAI's own masked-Aadhaar download is OTP-gated and slow
- Third-party alternatives are ad-riddled blogspot pages or Windows-only tools
- Privacy framing ("runs in your browser, nothing uploaded, read our code") is a genuine post-DPDP wedge

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
- **B2B API (paid, post-MVP):** HR tech (Keka, Darwinbox, Zimyo), fintech KYC (Digio, Hyperverge competitors), prop-tech KYC pipelines

## Tech stack

All client-side, zero server compute for the redaction flow:

- **Frontend:** Next.js 14 (App Router, static export)
- **Hosting:** Cloudflare Pages (free tier, India edge)
- **Analytics:** Cloudflare Web Analytics (free, no cookies, same-origin)
- **Email:** Cloudflare Email Routing (`hello@docredact.in` → personal inbox)
- **OCR:** Tesseract.js (English only, WASM)
- **Face detection:** face-api.js (WASM, lazy-loaded)
- **QR detection:** zxing-wasm
- **PDF read:** pdf.js (rasterize every page)
- **PDF write:** pdf-lib (build image-only flattened PDF)
- **Payments (post-MVP):** Razorpay for B2B API tier

Cost at MVP: ~₹600/year (domain only). Everything else on free tiers.

## MVP scope

**Build phase (5 weekends):**
- **W1:** Detection core — Tesseract + Aadhaar detector with Verhoeff + PAN detector
- **W2:** PDF flatten pipeline (rasterize → mask → image-only PDF) + download flow
- **W3:** Face blur + UIDAI QR + passport MRZ + mobile camera-capture hero CTA
- **W4:** Flagship SEO page (`/mask-aadhaar-online`) + privacy + terms + how-it-works + CSP lockdown + waitlist + contact + domain + analytics
- **W5:** Polish + multi-page preview + GitHub repo public + AGPL headers

**Launch phase:**
Gradual rollout across developer and consumer communities, iterating on feedback between each step.

Deliberate v1 omissions: no Pro tier, no batch, no accounts, no payments, no API, no PWA, no regional languages, no scenario presets. Consumer is 100% free. Revenue arrives via B2B conversations in month 3+.

## Design docs

- [`RFC.md`](RFC.md) — technical design, detection pipeline, architecture, milestones, locked decisions
- [`CLAUDE.md`](CLAUDE.md) — project context, tech decisions, positioning guardrails, validation gates

## Kill criteria

- 90-day organic traffic < 5K visits on `/mask-aadhaar-online` → keyword demand over-estimated
- 6 months live, zero inbound from HR tech / fintech for the B2B API waitlist → B2B upgrade path isn't real
- Major incumbent (iLovePDF / Smallpdf / Adobe) ships India-specific auto-detect for free → consumer differentiation gone

## License

DocRedact.in is licensed under the [GNU Affero General Public License v3.0](LICENSE).

## Contact

- Bugs / features: [GitHub Issues](https://github.com/shadab127/doc-redact-in/issues)
- Private feedback: `hello@docredact.in`

## Related parked ideas

See `../parked-ideas/doc-redact-in.md` for original analysis.
