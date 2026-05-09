# QR visual locator spike — 2026-05-09

Prior QR decode spike (round 2) concluded that the 11 zxing decode misses
are input-quality failures no decoder/preprocessor in our toolbox fixes.
User proposal: *stop trying to decode, try to visually locate a QR-shaped
region and mask it anyway*. Product goal is masking, not reading the
payload.

This spike tested that idea with a grid-based OCR-void + bimodal-texture
locator (approach #4), fallback-only (fires only when zxing+jsQR decode
returns 0).

## Method

`src/detection/QrVisualLocator.ts` — the research code (reverted from
orchestrator before committing; kept as a ready helper):
- Grid the canvas into ~24 cells per long-edge side
- Score each cell: grayscale stdev (texture), and black+white fraction (bimodality)
- Candidate cells: (textured OR bimodal) AND not on OCR text
- 4-neighbour connected-component clustering
- Filter: aspect ratio 0.75–1.33, area 0.5%–25% of canvas, ≥60% cells bimodal
- Reject candidates ≥40% overlapping a detected face
- Emit `other_qr` with confidence 0.4

Wired into `DetectionOrchestrator.runDetectors` between the face/QR
parallel block and return. Fires only when the QR decoders returned 0
detections.

Measurement run: `spikes/report-accuracy-2026-05-09T10-04-15-870Z.md`
(V5 on the 51-sample accuracy harness).

## Results

| Variant | Samples hit | UIDAI QR | Other QR | Aadhaar | Face | Errors |
|---|---|---|---|---|---|---|
| V0 CLAHE baseline | 48/51 | 17 | 0 | 51 | 45 | 0 |
| V5 OCR-void locator | 48/51 | 17 | 8 | 51 | 45 | 0 |

The locator fired 8 times across 7 samples, all on samples where zxing
had failed. No samples flipped status. Zero FPs on the verified no-QR
sample (`Screenshot 2026-05-02 at 9.56.28 PM.png`) and its rotations —
the most important invariant, and the locator held it.

## Bbox eyeball

Per `feedback_verify_detector_output.md`: every detection was annotated
on the source image and visually compared against the known QR location.

| Sample | Bbox | Verdict |
|---|---|---|
| `WA 3.06.31 PM (1)_rot90.jpeg` (1599×899) | (1254,462) 330×396 | FP — box on right edge (dark background / card border), QR is elsewhere |
| `WA 4.31.04 PM.jpeg` (540×1170) | (384,576) 96×96 | FP — box in white strip between two stacked cards; QR is further up |
| `WA 4.31.04 PM_rot90.jpeg` (1170×540) | (384,576) 96×96 | FP — same relative region as above, rotated |
| `WA 4.31.04 PM_rot180.jpeg` (540×1170) | (384,480) 96×96 | FP |
| `WA 4.31.04 PM_rot270.jpeg` (1170×540) | 2 boxes at 96×96 | FP on both |
| `sample1_rot90.jpeg` (631×800) | (297,297) 66×66 | FP — center of card body, over text; QR at bottom-left in this rotation |
| `sample1_rot180.jpeg` (800×631) | (99,165) 231×297 | FP — covers face photo + name text; QR is in bottom-right |

**0/8 boxes on an actual QR.** Every firing was a spurious textured
region matching the locator's criteria by accident. This mirrors the
prior scan-line finder-pattern locator failure: Aadhaar cards have rich
square-ish bimodal regions (borders between sections, photo, text
blocks, QR itself) that a coarse grid locator cannot distinguish from
the real QR.

## Why it fails

The locator's premise — "a textured, bimodal, square, text-free region
is probably a QR" — has a hidden assumption: that QR-like regions are
rare on the document. Aadhaar cards violate this:
- Card borders / section dividers: high contrast, bimodal, text-free
- Face photo when illumination is uneven: textured, may pass
  bimodality at tile resolution if the face is grayscale-printed
- Empty margin regions between card sections: bimodal (card vs
  background), text-free, small enough to satisfy aspect

The reject-overlap-with-face check catches photo FPs only when the face
detector succeeded; on samples where face detection missed, the photo
region still satisfies the criteria.

## Approach #2 (entropy-patch) — dropped

Originally planned as a follow-up if #4 looked promising. Entropy-patch
scoring (bimodal histogram + edge density) is strictly *more* FP-prone
than #4's texture+bimodality — it would trigger on exactly the same
regions plus more (logos, emblems). Running it would burn time for a
known answer: same failure pattern at higher FP rate.

## Recommendation — ship nothing, keep research code

Reverted `DetectionOrchestrator.ts` to the V0 config. The
`src/detection/QrVisualLocator.ts` file stays in the repo as reference
for anyone picking this up later, but is not wired.

Everything here confirms the prior spike's conclusion: **the hard
problem isn't "can we find a QR" — it's "can we reliably tell apart a
QR from other square bimodal regions on an ID card".** Grid-based
heuristics can't. The approaches that might:

1. **CNN-based QR detector (WeChat QR via OpenCV.js, ~3 MB WASM+model).**
   Trained on real QRs; discriminates QR vs logo/photo/text-block.
   Bundle cost needs its own feasibility check.
2. **YOLO-QR / ONNX tiny detector.** Similar story, also heavy.
3. **Manual draw-to-redact** (RFC §4.9). Ships a user-driven escape
   hatch for every miss — not just QR, every detector miss. This is
   the product-right next step regardless of whether a CNN locator
   ever lands: it closes the trust gap ("tool missed my QR, now what?")
   in one shot instead of playing whack-a-mole with detector heuristics.

The research code in `QrVisualLocator.ts` is not wasted — if anyone
does ship a CNN locator later, the grid-candidate-filter plumbing
(aspect/area filters, OCR-void masking, face-overlap rejection) will
still be useful as a post-filter to cull CNN FPs.

## What didn't change (production invariants)

- `DetectionOrchestrator.ts` is back on V0 (zxing + CLAHE OCR fallback only)
- 172 unit tests pass
- `tests/e2e/no-outbound-network.spec.ts` invariant preserved
- No new npm deps added
