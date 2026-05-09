# Aadhaar Recall Spike — ImagePreprocessor Integration

**Started:** 2026-05-09T06:57:03.041Z  
**Hypothesis:** Wiring `ImagePreprocessor.ts` into the OCR path lifts Aadhaar recall from 80% baseline  
**Single variable:** preprocessor on vs off — everything else constant  
**Samples:** 10 image files (3 PDFs excluded — require rasterization step outside scope)  
**Preprocessor pipeline:** `toGrayscale(BT.601)` → `gaussianBlur3x3` → `applyClaheGlobal(clipLimit=0.01)`  
**Harness:** Node 25 + tesseract.js 5.1.1 in Node mode + Python PIL faithfully porting the TS preprocessor  

---

## Per-Sample Results

| filename | baseline | preprocessed | notes |
|----------|----------|--------------|-------|
| sample-shadab.jpeg | HIT | HIT | same value both paths: XXXXXXXXXXXX |
| Screenshot 2026-05-02 at 9.56.28 PM.png | MISS | HIT | MISS→HIT; detected XXXXXXXXXXXX |
| Screenshot 2026-05-02 at 9.56.54 PM.png | HIT | HIT | same value both paths: XXXXXXXXXXXX (detected twice — duplicate) |
| Screenshot 2026-05-03 at 4.39.17 PM.png | HIT | HIT | same value both paths: XXXXXXXXXXXX |
| WhatsApp Image 2026-05-03 at 3.06.30 PM.jpeg | HIT | MISS | HIT→MISS; baseline detected XXXXXXXXXXXX |
| WhatsApp Image 2026-05-03 at 3.06.31 PM (1).jpeg | MISS | MISS | — |
| WhatsApp Image 2026-05-03 at 3.06.31 PM.jpeg | MISS | MISS | — |
| WhatsApp Image 2026-05-03 at 4.31.04 PM.jpeg | HIT | HIT | same value both paths: XXXXXXXXXXXX (detected twice — duplicate) |
| sample-a1.jpg | HIT | HIT | same value both paths: XXXXXXXXXXXX |
| sample1.jpeg | MISS | MISS | — |

---

## Aggregate

Baseline: **6/10**  
Preprocessed: **6/10**  
Delta: **0** (net flat — 1 gained, 1 lost, 8 unchanged)

MISS→HIT (preprocessor helped): `Screenshot 2026-05-02 at 9.56.28 PM.png`  
HIT→MISS (preprocessor hurt): `WhatsApp Image 2026-05-03 at 3.06.30 PM.jpeg`

*(3 PDF samples excluded — would need pdf.js rasterization. PDFs are e-Aadhaar which tend to be clean; they likely HIT on both paths, so the underlying image-only baseline is probably 6/10, not the 80% memory figure which counted PDFs.)*

---

## Eyeball Section

### MISS→HIT: Screenshot 2026-05-02 at 9.56.28 PM.png

**What the baseline OCR produced:** 100 tokens, zero 4-digit groups. The Aadhaar number row was not tokenised into digit groups at all — it was either missed or merged into garbage tokens. No detectable 12-digit string.

**What the preprocessed OCR produced:** 93 tokens, three 4-digit groups on line 14: `"8850"`, `"9342"`, `"3296"` (confidence 0.90/0.90/0.97). Concatenated: `XXXXXXXXXXXX`. Verhoeff passes.

**Is this a true positive or false positive?**  
The same value `XXXXXXXXXXXX` is detected on two other screenshots (`9.56.54 PM` baseline and `sample-shadab.jpeg` baseline) from the same physical Aadhaar card. The OCR also extracted `"[redacted]"`, `"[redacted]"`, `"DOB: [redacted-dob]"`, `"MALE"` and `"Aadhaar is proof of identity..."` — all consistent with a real Aadhaar card. **This is a true positive.** CLAHE increased contrast on what appears to be a slightly washed-out screenshot, making the digit row clearly parseable.

**FP risk: zero** — value matches a known Aadhaar in the same dataset, and Verhoeff passes.

---

### HIT→MISS: WhatsApp Image 2026-05-03 at 3.06.30 PM.jpeg

**What the baseline OCR produced:** 40 tokens, three 4-digit groups on line 11: `"5757"`, `"3195"`, `"4524"` (confidence 0.95/0.94/0.94). Concatenated: `XXXXXXXXXXXX`. Verhoeff passes. Card holder is `"[redacted-name]"`, father `"[redacted-name]"`, DOB `[redacted-dob]`, Male.

**What the preprocessed OCR produced:** 41 tokens, **zero 4-digit groups**. The Aadhaar row line 11 is completely absent. Comparing token dumps: the image was a WhatsApp-compressed JPEG with low contrast in the number region. CLAHE on a low-contrast image can over-amplify noise and render digit strokes indistinguishable from background. Specifically, the preprocessing converted what was a legible-but-low-contrast digit strip into uniform gray sludge.

**Root cause:** `applyClaheGlobal` with `clipLimit=0.01` is too aggressive for already-well-exposed images. The digit row in this WhatsApp image had enough original contrast for Tesseract but the CLAHE redistribution destroyed it.

**Regression severity: hard** — this was a confident 0.94–0.95 detection on a real Aadhaar that now returns nothing.

---

## Analysis

The preprocessor produces **net zero delta** (+1, -1) on the 10 image samples. Breaking this down:

- **4 samples (MISS MISS):** Samples where both paths fail. On these (`WhatsApp 3.06.31 x2`, `sample1.jpeg`, `WA 3.06.31 PM (1)`), neither baseline nor preprocessor extracts a Verhoeff-valid triplet. These are likely: rotated cards, heavily blurred WhatsApp compression, or the Aadhaar number is partially cropped. The preprocessor doesn't rescue them.
- **5 samples (HIT HIT):** The preprocessor is neutral — detection already works. 
- **1 sample (MISS→HIT):** Screenshot with a washed-out Aadhaar number; CLAHE helped.
- **1 sample (HIT→MISS):** WhatsApp JPEG where CLAHE destroyed the digit row; clearly a regression.

The `clipLimit=0.01` default is too aggressive for real-world images. The same CLAHE that helps a washed-out screenshot hurts a normally-exposed WhatsApp photo. The preprocessor as currently written is not universally safe to apply before OCR.

---

## Recommendation

**DON'T-SHIP** (as-is).

Rationale:
1. Net recall change is zero on image samples (+1 gained, -1 lost).
2. The regression is on a real-person Aadhaar (not an edge case) — a confident 3×0.94 detection on a real card disappears entirely.
3. Shipping a preprocessor that hurts one class of images while helping another is not a net win. It is a lateral trade-off, and the spec from `RFC.md` requires we raise recall, not maintain it while introducing regressions.

**What to try next (not in scope for this spike):**
- Apply preprocessing only when the raw pass yields zero hits (fallback-only mode). This eliminates the regression on already-working images while potentially rescuing a few MISS→HIT cases.
- Reduce `clipLimit` from 0.01 to 0.005 or skip CLAHE entirely — the gain from CLAHE may not be worth the risk to already-legible images.
- The 4 persistent MISS samples likely need rotation probing or multi-scale OCR, not contrast adjustment.
- PDFs (3 excluded here) are e-Aadhaar which are clean black-on-white — preprocessing is unlikely to help them and could regress them similarly.

*PDFs require pdf.js rasterization — out of scope for this spike.*

---

*Spike completed: 2026-05-09T06:58:00.000Z*  
*Harness: `spikes/run-aadhaar-spike.mjs` + `spikes/preprocess_image.py` + `spikes/eyeball-detail.mjs`*
