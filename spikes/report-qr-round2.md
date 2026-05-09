# QR recall spike — round 2 (2026-05-09)

Four approaches measured against the V0 baseline (production as of commit
`6bf5653`: zxing-wasm 3.0.2 + `tryHarder:true` + CLAHE-fallback on OCR, no
QR preprocessing). Harness: `tests/e2e/accuracy-harness.spec.ts` on 51
real samples. Prior round rejected: zxing version/options tuning, naive
upfront upscale, 1:1:3:1:1 scan-line locator.

## Summary table

| Variant | Samples hit | UIDAI QR | Other QR | Aadhaar | Face | Errors | Notes |
|---|---|---|---|---|---|---|---|
| V0  CLAHE baseline | 48/51 | 17 | 0 | 51 | 45 | 0 | reference |
| V1  jsQR union + empty-guard | 48/51 | 17 | 0 | 51 | 45 | 0 | jsQR produces 0 real decodes after the empty-string FP is guarded out |
| V2  zxing + Otsu-fallback | 48/51 | 17 | 0 | 51 | 45 | 0 | Global Otsu strictly weaker than zxing's built-in HybridBinarizer |
| V3  zxing + 2× upscale fallback | 48/51 | 17 | 0 | 51 | 45 | 0 | Prior round already ruled out upfront 2×/4×; fallback-only is not better |
| V4  all fallbacks + jsQR (ceiling) | 46/51 | 17 | 0 | 48 | 43 | 2 | 2 samples hit the 120s timeout — detections never arrived; net regression |

All four variants produced **zero net lift** on UIDAI QR. V4 actively
regressed by timing out on two samples.

## Per-variant detail

### V1 — jsQR union with empty-payload guard

First unguarded run (included in commit history as timestamped report
`report-accuracy-2026-05-09T08-18-35-328Z.md`) produced `other_qr=1` on
`sample6_rot90.webp`. A Node probe against jsQR confirmed the decoded
payload was **empty string of length 0** — the location was noise-driven,
not a real QR. Added `result.data.length < 8` guard in `JsqrDetector.ts`
and re-ran: sample6_rot90 correctly fell out, and no other sample
flipped. jsQR adds **no real decodes** on this 51-sample set.

### V2 — zxing with Otsu-binarised fallback

New helpers `otsuBinarizedCanvas` + `createPreprocessFallbackRunner` in
`QrDetector.ts`. Fallback-only: when zxing returns 0 on the raw canvas,
Otsu-binarize and retry. Result: identical to V0.

Reasoning post-hoc: zxing's HybridBinarizer does local-adaptive
thresholding that handles gradients and glare far better than a global
Otsu sweep. Replacing local with global is strictly worse for the
phone-photo failure class we care about. The fallback never unlocked a
decode zxing's primary binariser had missed.

### V3 — zxing with 2× upscale fallback

Same fallback-only pattern, with `upscaleCanvas` applying bilinear 2×.
Result: identical to V0.

Small-image samples (`adhar1` 636×400, `sample1` 800×631) remain misses.
The prior spike had already tested upfront 2× and 4× upscale and seen
zero lift; fallback-only doesn't change the underlying fact — zxing's
miss on these isn't a scale problem, it's a print-quality + glare
problem. Upsampling interpolated pixels doesn't manufacture information
that wasn't in the source.

### V4 — all fallbacks chained + jsQR union

`zxing → upscale fallback → Otsu fallback`, then union-merged with jsQR.
This is the "throw everything at it" ceiling. Result: **worse than V0**:

- `Screenshot 9.56.54 PM_rot90.png` — 120s timeout (error)
- `WA 3.06.31 PM_rot180.jpeg` — 120s timeout (error)

Why it times out: chained fallbacks on already-rotated large PNGs mean
zxing runs up to 3× (raw → 2× upscale → Otsu), each on a progressively
more expensive canvas, plus jsQR runs once on the raw canvas. The
rotated `Screenshot 9.56.54 PM_rot90.png` is 532×1680 ≈ 894 KP × 2× = 3.6
MP for the upscaled pass; zxing's `tryHarder:true` on 3.6 MP is ~20 s on
its own and both timed-out samples had zero QR to find, so they ran
every fallback.

Aadhaar and Face counts dropped (51→48, 45→43) because the timed-out
samples never reached the OCR/face steps either. Not a QR regression
per se — a *whole-pipeline* regression from pathological QR-fallback
latency.

## Recommendation — don't ship, keep helpers

Reverted `RedactorApp.tsx` to V0 (zxing-only, CLAHE-fallback for OCR).
The new helpers (`createPreprocessFallbackRunner`, `otsuBinarizedCanvas`,
`upscaleCanvas`, `composeQrRunners`) and the `JsqrDetector.ts` stay
exported in the repo as ready building blocks — same treatment as the
face OCR-overlap filter. If a user later reports a specific phone-shot
QR that our dataset doesn't cover, we can compose a targeted fallback
without re-writing the scaffolding.

## Harder problem than it looks

The 11 QR decode misses on this dataset break down as:
- 6× small/low-res (adhar1 636×400, sample1 800×631, sample2 768×1024,
  sample6 768×1024, sample6_rot90, sample6_rot180)
- 3× rotated card on dark surface (WA 3.06.31 and its rotations)
- 1× dense/noisy QR in a PDF reader screenshot (WA 4.31.04)
- 1× two-stacked-cards composition (Screenshot 4.39.17 PM)

These are **input-quality failures**, not algorithm failures. The prior
spike reached the same conclusion; this round confirms it empirically
with preprocessing variants and an alternative decoder.

## Next steps (not in this spike)

1. **Manual draw-to-redact** (RFC §4.9 — already specced, not built).
   Ships a user-driven escape hatch for every miss, not just QR misses.
   Highest-leverage path to "user gets their QR masked" regardless of
   detector ceiling.
2. **Server-side decoders** — out of bounds (breaks "nothing leaves your
   device" claim). Explicitly rejected.
3. **Deep-learning QR detectors** — WeChat QR, YOLO-QR. Interesting but
   WASM bundle cost would easily exceed the detection budget; would need
   its own feasibility spike.
4. **Sample reporting loop** — ask users who hit a miss to (locally)
   share a cropped region with consent. Post-launch.
