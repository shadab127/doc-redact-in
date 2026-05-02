# Project: DocRedact.in (Indian ID Redactor)

## Developer Profile
- **Primary skills:** Java, Kotlin (open to any language — AI-assisted coding)
- **Availability:** Weekends + 1–2 hours on weekday evenings
- **Working solo** (open to collaborators later)
- **Starting from zero** — no existing audience, blog, or social presence

## Project Goals
- Client-side, mobile-first web tool to auto-detect and redact Indian ID documents (Aadhaar, PAN, passport MRZ, UIDAI QR, face)
- Positioning: "Privacy-first redaction — nothing uploaded, everything in your browser, fully open source"
- Primary wedge: India-specific auto-detection that generic tools (iLovePDF, Smallpdf, Adobe) don't have
- Consumer tier is free forever; revenue comes from B2B API tier (HR tech, fintech KYC) post-MVP
- Brand moat: "the iLovePDF for people who don't trust iLovePDF" — launch pad for adjacent client-side utility tools

## Constraints
- **~₹600/year budget (domain only)** — everything else runs on free tiers
- Cloudflare Pages + Cloudflare Web Analytics + Cloudflare Email Routing — single-provider free stack
- No paid APIs, no server-side OCR, no server-side PII handling — ever
- Every tech choice must have a viable free tier for MVP
- Weekend-only cadence: 5 weekends to MVP, 3 weeks sequenced launch

## Locked Decisions (from 20-question clarifying review)

| # | Area | Decision |
|---|------|----------|
| 1 | PDF output | Always flatten to image-only PDF (no text-layer leak) |
| 2 | OCR language | English-only Tesseract; Verhoeff filters false positives |
| 3 | Mobile UX | Mobile-first; camera capture is the primary hero CTA on mobile |
| 4 | Analytics | Cloudflare Web Analytics (same-origin, free, no cookies) |
| 5 | Source | Fully open source from day 1 |
| 6 | PWA | Skip for MVP |
| 7 | SEO pages | 1 flagship page at launch (`/mask-aadhaar-online`); add others in month 2 based on GSC data |
| 8 | B2B waitlist form | Email + company + use case dropdown |
| 9 | Verification flow | Toggle list IS the verification (resolved via Q below) |
| 10 | Mask styles | Black rectangle (Aadhaar/PAN/MRZ/QR) + Gaussian blur σ=30 (faces). Fixed, no user choice. |
| 11 | File limit | 20MB hard cap |
| 12 | Error tracking | None in MVP |
| 13 | Browser support | Modern WASM-capable browsers only; unsupported-browser page for rest |
| 14 | Domain | Register `docredact.in` now (~₹600/yr) |
| 15 | License | AGPL-3.0-or-later |
| 16 | Multi-page preview | Single-page view with prev/next; detection runs on all pages upfront |
| 17 | Download filename | `[original]_redacted.pdf` |
| 18 | Contact | GitHub Issues + `hello@docredact.in` via Cloudflare Email Routing |
| 19 | Privacy policy | Plain-English custom, matches radical-transparency brand |
| 20 | Launch | Sequential over 3 weeks: r/developersIndia → Show HN → Product Hunt India + r/india |

## Tech Decisions
- Frontend: Next.js 14 (App Router, static export)
- Hosting: **Cloudflare Pages** (NOT Vercel — Cloudflare chosen for same-origin analytics + single provider)
- Analytics: **Cloudflare Web Analytics** (free, no cookies, same-origin)
- Email: **Cloudflare Email Routing** (free inbox forwarding)
- OCR: Tesseract.js (WASM, English only, client-side)
- Face detection: face-api.js (WASM, lazy-loaded)
- QR detection: zxing-wasm
- PDF read: pdf.js (rasterize every page)
- PDF write: pdf-lib (build image-only PDF)
- Payments (post-MVP only): Razorpay for B2B API tier
- **Explicitly rejected:** server-side OCR, any backend that sees file contents, logins/accounts in v1, Vercel hosting, Plausible, Google Analytics, Sentry/LogRocket, PWA in v1, multiple SEO landing pages in v1, scenario presets in v1, regional language Tesseract packs in v1

## Positioning Guardrails
- Never use words: "we process your document," "we store," "we analyze your data"
- Use instead: "your browser processes," "nothing leaves your device," "zero server touches"
- Disclaimers on output: "Verify redaction before sharing. You are responsible for the final output."
- Network-inspector-visible assertion: "no document-data requests leave your device" (enforced in CI)
- Liability framing: product provides tooling; user verifies correctness
- Output PDF disclaimer: "Image-only PDF to prevent text extraction of redacted content. Larger file, no searchable text."

## Development Approach
- MVP-first — ship the simplest working version before adding features
- Do not over-engineer or add features beyond current milestone
- Keep code simple and maintainable for a solo developer
- Prefer fewer dependencies over many
- Every dependency must justify its byte cost on first page load (mobile 3G matters)
- OCR accuracy on real-world Indian documents is the make-or-break — invest preprocessing time here, not on UI polish
- Verhoeff checksum validation on Aadhaar is non-negotiable (prevents false-positive masking)
- Refer to RFC.md for detailed technical design and milestones

## Open-Source Policy
- License: AGPL-3.0-or-later
- Every source file carries a short AGPL header
- `LICENSE` file at repo root contains full AGPL-3.0 text
- `package.json` declares `"license": "AGPL-3.0-or-later"`
- Commit history preserved — no squashes or force-pushes on `main`
- External contributions welcome via PRs; no CLA in v1 (solo maintainer)

## Validation Gates (Pre-Weekend-1)
1. Tesseract accuracy spike on 20 real Aadhaar photos → need ≥85% achievable with preprocessing
2. Verhoeff implementation passes UIDAI's 200-vector test
3. Competitor spot-check: iLovePDF/Smallpdf/Adobe confirmed not doing India-specific auto-detect
4. SEO volume check: "mask aadhaar online" + "aadhaar masking tool" > 5K/mo combined
5. CSP feasibility: all WASM libraries work under strict CSP with `wasm-unsafe-eval` only
6. Cloudflare Pages + Next.js static export compatibility confirmed
7. `docredact.in` domain available; if not, rename decision made before Weekend 1

## Related / Parked Ideas
- Original parked analysis: `../parked-ideas/doc-redact-in.md`
- Adjacent brand extensions (post-MVP, not scoped): DocSplit.in, KYCSafe.in — client-side utility tools under same privacy-first brand
- Other hobby-projects parked: `~/toast/hobby-projects/parked-ideas/` — read before re-proposing features
