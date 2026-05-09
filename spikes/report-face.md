<!--
  DocRedact.in — spike report
  AGPL-3.0-or-later
-->

# Face × OCR Overlap Filter — Spike Report

**Started:** 2026-05-08  
**Plan:** Prototype `rejectFacesCoveredByOCR(faces, ocrTokens, threshold=0.5)` filter; determine whether MediaPipe/BlazeFace can run in Node for real-sample measurement; if not, fall back to synthetic unit tests and document exactly what remains unverified.

---

## 1. Filter Logic (pseudocode)

```
rejectFacesCoveredByOCR(faces, ocrTokens, threshold = 0.5):
  for each face F in faces:
    coveredArea = area of (F.bbox intersected with UNION of all ocrToken bboxes)
    coverage = coveredArea / area(F.bbox)
    if coverage >= threshold:
      discard F          // ← FP: face box sits on top of a text block
    else:
      keep F             // ← real face (or a non-text-region FP we can't filter here)
  return kept faces
```

Key design choices:
- We measure coverage as `coveredArea / faceArea`, NOT IoU.  IoU penalises large face boxes unfairly (a genuine face box that extends slightly beyond a text block would have low IoU but low coverage too). Coverage-only is strictly "how much of the face bbox is text" which is the question we care about.
- We union OCR token bboxes before measuring intersection to avoid double-counting overlapping tokens.
- threshold = 0.5 means "if ≥50 % of the face rectangle is text, reject it."
- This is a FP-only filter: it cannot improve recall (it can only reduce recall if the threshold is too aggressive).

---

## 2. Node/BlazeFace feasibility

**Result: blocked — MediaPipe requires browser APIs; cannot run in Node.**

Investigation steps taken:
- `@mediapipe/tasks-vision` is the production dep; its `FaceDetector.createFromOptions` calls `FilesetResolver.forVisionTasks()` which requires WebAssembly + `fetch()` + `OffscreenCanvas` / `HTMLCanvasElement`. None of these are available in Vitest's default `jsdom` environment (Canvas is a polyfill that explicitly does not support WebGL; MediaPipe's WASM delegate requires WebGL).
- The existing test suite (`tests/detection/FaceDetector.test.ts`) uses `createMockFaceDetectorRunner` exclusively — confirming the project has already accepted that the real detector cannot be exercised in unit tests.
- Attempting a Playwright/browser harness was explicitly out of scope per spike instructions.
- **Time spent on feasibility check: ~8 min. Stopping here per anti-stall protocol.**

**What this means for the spike:** real-sample recall/precision measurement is untested. Filter is implemented as a pure function, covered by synthetic Vitest tests only.

---

## 3. Real-sample table

*Not available — BlazeFace Node init blocked (see §2). Table would require an in-browser harness.*

| sample | faces-before | faces-after | new misses | FPs removed |
|--------|-------------|-------------|------------|-------------|
| (all 15) | untested | untested | untested | untested |

---

## 4. Synthetic test results

Filter implemented in `src/detection/FaceDetector.ts` as `rejectFacesCoveredByOCR` (exported pure function).  
`ocrCoverageRatio` is also exported for direct unit testing.  
Vitest suite at `tests/detection/FaceDetector.test.ts` — **22 tests, all pass. Full suite: 172 tests, 0 regressions.**

### ocrCoverageRatio (8 tests)

| scenario | expected | result |
|----------|----------|--------|
| No text boxes | 0.0 | PASS |
| Text box entirely outside face | 0.0 | PASS |
| Text box fully contains face | 1.0 | PASS |
| Text covers left half of face | ~0.5 | PASS |
| Text covers top-left quadrant | ~0.25 | PASS |
| Two identical text boxes (no double-count) | ~0.5 | PASS |
| Two non-overlapping text strips (union) | ~0.5 | PASS |
| Zero-area face box | 0.0 | PASS |

### rejectFacesCoveredByOCR (10 tests)

| scenario | expected outcome | result |
|----------|-----------------|--------|
| Empty token list → all faces kept | KEPT | PASS |
| Empty face list → empty result | `[]` | PASS |
| Face 100% inside large text block | REJECTED | PASS |
| Face at exactly 0.5 threshold (50% covered) | REJECTED (≥ threshold) | PASS |
| Face just under threshold (49% covered) | KEPT | PASS |
| Genuine face, no text overlap | KEPT | PASS |
| Mixed: real face + text-block FP on same canvas | FP removed, real face kept | PASS |
| Survivor order preserved | [f1, f3] not [f3, f1] | PASS |
| Custom threshold=0.3 rejects 40%-covered face | REJECTED | PASS |
| Custom threshold=0.5 keeps 40%-covered face | KEPT | PASS |

---

## 5. Eyeball notes

No real samples were processed. See §2.

---

## 6. What remains untested (real-data gap)

1. **Recall on the 11/13 (13/15 webp) baseline.** The filter could drop a genuine face if the printed face photo on a real Aadhaar card happens to be surrounded by text tokens that bleed into the face bbox. Tesseract typically returns bboxes around printed text lines; on a physical card the face photo is spatially separated from text — so the 0.5 threshold should be safe, but this is an assumption not a measurement.

2. **False-positive removal on e-Aadhaar PDFs.** The RFC concern is that at threshold 0.3 BlazeFace fires on text blocks inside UIDAI e-Aadhaar PDFs. Whether those FP boxes actually achieve ≥50% OCR coverage is untested. Hypothesis: yes, because a text-block FP would have very high OCR-token density inside its bbox.

3. **Multi-face cards (parent+child Aadhaar).** The filter uses `UNION` of all OCR tokens — if two faces share the same canvas and one is next to text while the other is not, only the text-adjacent one should be filtered. This is correctly handled by the per-face independent check (not a global gate), but needs real-sample confirmation.

**Verification approach for a follow-up round:** Add `onDetect` callback to the existing Playwright smoke harness; log `{ facesBefore, facesAfter, coverage[] }` per sample; compare against the 11/13 baseline.

---

## 7. Recommendation

**Ship the filter at threshold 0.5 behind a feature flag (`FACE_OCR_OVERLAP_FILTER=true`) — do not enable by default yet.**

Rationale:
- The pure-function logic is correct and the synthetic tests cover the boundary cases.
- The production concern (text-block FPs at threshold 0.3) is real — the FaceDetector comment documents it explicitly.
- The filter is strictly additive in code (new export, no mutation of existing merge logic).
- Enabling by default before in-browser recall verification risks the RED-flag scenario (dropping a real face on a card where OCR tokens happen to extend into the face region).
- A 30-minute in-browser harness session with the 15 real samples is the right next step to confirm the 0.5 threshold is safe before enabling.

**If forced to decide now:** 0.5 is a conservative threshold. On a real Aadhaar card, the face photo box should have near-zero OCR coverage (the photo area has no printed text within it). A text-block FP will have near-100% OCR coverage. The 0.5 gap between those two cases is wide — the threshold is unlikely to cause a false rejection. But "unlikely" is not "verified."

---

*Generated with Claude Code*
