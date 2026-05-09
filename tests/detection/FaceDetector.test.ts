/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';
import {
  createMockFaceDetectorRunner,
  mergeFaceDetections,
  ocrCoverageRatio,
  rejectFacesCoveredByOCR,
} from '@/src/detection/FaceDetector';
import type { BoundingBox, Detection, OCRToken } from '@/src/detection/types';

function face(x: number, y: number, w: number, h: number, confidence: number): Detection {
  return {
    kind: 'face',
    bbox: { x, y, w, h },
    maskBbox: { x, y, w, h },
    value: 'face',
    confidence,
  };
}

describe('mergeFaceDetections', () => {
  it('dedupes near-identical boxes and keeps the higher-confidence one', async () => {
    // Short-range and full-range both fire on the same face — union→merge
    // must surface one detection, and it must be the one the caller can
    // trust most (higher confidence implies tighter localisation).
    const merged = mergeFaceDetections(
      [
        face(100, 100, 200, 240, 0.71),
        face(102, 98, 198, 242, 0.88),
      ],
      0.3
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]!.confidence).toBeCloseTo(0.88);
  });

  it('keeps two detections when the IoU is below threshold', async () => {
    // A scan of a father/son photo on an ID page: two faces side by side,
    // no pixel overlap. Both must survive.
    const merged = mergeFaceDetections(
      [face(0, 0, 100, 100, 0.9), face(500, 500, 100, 100, 0.8)],
      0.3
    );
    expect(merged).toHaveLength(2);
  });

  it('keeps two detections when overlap is marginal (below threshold)', async () => {
    // Side-by-side boxes with a small overlap: ~25% IoU, which must NOT
    // trigger a merge at the 0.3 threshold.
    const merged = mergeFaceDetections(
      [face(0, 0, 100, 100, 0.9), face(80, 0, 100, 100, 0.8)],
      0.3
    );
    expect(merged).toHaveLength(2);
  });

  it('returns empty array unchanged', async () => {
    expect(mergeFaceDetections([], 0.3)).toEqual([]);
  });
});

describe('createMockFaceDetectorRunner', () => {
  it('returns the configured detections unchanged', async () => {
    const fake: Detection[] = [
      {
        kind: 'face',
        bbox: { x: 200, y: 80, w: 180, h: 220 },
        maskBbox: { x: 200, y: 80, w: 180, h: 220 },
        value: 'face',
        confidence: 0.82,
      },
    ];
    const runner = createMockFaceDetectorRunner(fake);
    const out = await runner.detect({ width: 1000, height: 800 } as unknown as HTMLCanvasElement);
    expect(out).toEqual(fake);
    expect(out[0]!.kind).toBe('face');
    expect(out[0]!.confidence).toBeGreaterThanOrEqual(0.6);
  });
});

// ---------------------------------------------------------------------------
// Helpers for OCR-filter tests
// ---------------------------------------------------------------------------

function bbox(x: number, y: number, w: number, h: number): BoundingBox {
  return { x, y, w, h };
}

function tok(x: number, y: number, w: number, h: number): OCRToken {
  return {
    text: 'x',
    bbox: { x, y, w, h },
    confidence: 0.95,
    lineId: 0,
  };
}

// ---------------------------------------------------------------------------
// ocrCoverageRatio
// ---------------------------------------------------------------------------

describe('ocrCoverageRatio', () => {
  it('returns 0 when there are no text boxes', () => {
    expect(ocrCoverageRatio(bbox(0, 0, 100, 100), [])).toBe(0);
  });

  it('returns 0 when the text box does not overlap the face', () => {
    // Text box is entirely to the right of the face
    expect(ocrCoverageRatio(bbox(0, 0, 100, 100), [bbox(200, 0, 50, 50)])).toBe(0);
  });

  it('returns 1.0 when a single text box fully covers the face', () => {
    // Text box is larger than (and contains) the face
    const ratio = ocrCoverageRatio(bbox(10, 10, 80, 80), [bbox(0, 0, 200, 200)]);
    expect(ratio).toBeCloseTo(1.0, 5);
  });

  it('returns ~0.5 when a text box covers exactly the left half of the face', () => {
    // Face: x=0..100, y=0..100 (area=10000)
    // Text: x=0..50,  y=0..100 (covers left half)
    const ratio = ocrCoverageRatio(bbox(0, 0, 100, 100), [bbox(0, 0, 50, 100)]);
    expect(ratio).toBeCloseTo(0.5, 2);
  });

  it('returns ~0.25 when a text box covers the top-left quadrant of the face', () => {
    const ratio = ocrCoverageRatio(bbox(0, 0, 100, 100), [bbox(0, 0, 50, 50)]);
    expect(ratio).toBeCloseTo(0.25, 2);
  });

  it('does not double-count overlapping text boxes', () => {
    // Two text boxes that both cover the left half of the face.
    // Union should still be 50%, not 100%.
    const ratio = ocrCoverageRatio(
      bbox(0, 0, 100, 100),
      [bbox(0, 0, 50, 100), bbox(0, 0, 50, 100)]
    );
    expect(ratio).toBeCloseTo(0.5, 2);
  });

  it('correctly unions two non-overlapping text boxes inside the face', () => {
    // Left strip (0–25) + right strip (75–100) = 50% coverage total
    const ratio = ocrCoverageRatio(
      bbox(0, 0, 100, 100),
      [bbox(0, 0, 25, 100), bbox(75, 0, 25, 100)]
    );
    expect(ratio).toBeCloseTo(0.5, 2);
  });

  it('returns 0 for a zero-area face box', () => {
    expect(ocrCoverageRatio(bbox(10, 10, 0, 50), [bbox(0, 0, 100, 100)])).toBe(0);
    expect(ocrCoverageRatio(bbox(10, 10, 50, 0), [bbox(0, 0, 100, 100)])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// rejectFacesCoveredByOCR — the main filter
// ---------------------------------------------------------------------------

describe('rejectFacesCoveredByOCR', () => {
  it('keeps all faces when ocrTokens list is empty', () => {
    const f = face(0, 0, 100, 100, 0.8);
    expect(rejectFacesCoveredByOCR([f], [])).toEqual([f]);
  });

  it('keeps all faces when faces list is empty', () => {
    expect(rejectFacesCoveredByOCR([], [tok(0, 0, 200, 200)])).toEqual([]);
  });

  it('rejects a face that is 100% covered by a large text block', () => {
    // Simulates: BlazeFace fires on a text paragraph in an e-Aadhaar PDF.
    // The face bbox sits entirely inside a big OCR token region.
    const result = rejectFacesCoveredByOCR(
      [face(50, 50, 100, 80, 0.52)],
      [tok(0, 0, 1000, 600)]  // entire page is "text"
    );
    expect(result).toHaveLength(0);
  });

  it('rejects a face at exactly the 0.5 threshold (coverage >= 0.5 → reject)', () => {
    // Face: x=0..100, y=0..100. Token covers left half → ratio = 0.5
    const result = rejectFacesCoveredByOCR(
      [face(0, 0, 100, 100, 0.55)],
      [tok(0, 0, 50, 100)]
    );
    expect(result).toHaveLength(0);
  });

  it('keeps a face just under the threshold (coverage = 0.49)', () => {
    // Token covers only 49 columns out of 100 → coverage ≈ 0.49 → keep
    const result = rejectFacesCoveredByOCR(
      [face(0, 0, 100, 100, 0.55)],
      [tok(0, 0, 49, 100)]
    );
    expect(result).toHaveLength(1);
  });

  it('keeps a genuine face with no text overlap at all', () => {
    // Face photo in upper-right; text tokens are all in the lower portion
    const genuineFace = face(600, 50, 120, 150, 0.85);
    const tokens = [
      tok(0, 300, 400, 30),  // "Name:" line
      tok(0, 340, 400, 30),  // "DOB:" line
      tok(0, 380, 400, 30),  // "Address" line
    ];
    const result = rejectFacesCoveredByOCR([genuineFace], tokens);
    expect(result).toHaveLength(1);
    expect(result[0]!.confidence).toBeCloseTo(0.85);
  });

  it('filters only the text-block FP while keeping a real face on the same canvas', () => {
    // Two "face" detections: one is a real face in the top-right (no text
    // overlap), one is a FP on a text block in the lower-left (high overlap).
    const realFace = face(600, 50, 120, 150, 0.85);
    const textFp  = face(30,  280, 380, 100, 0.51); // sits on text region
    const tokens = [
      tok(0, 260, 500, 50),
      tok(0, 310, 500, 50),
      tok(0, 360, 500, 50),
    ];
    const result = rejectFacesCoveredByOCR([realFace, textFp], tokens);
    expect(result).toHaveLength(1);
    expect(result[0]!.confidence).toBeCloseTo(0.85);
  });

  it('preserves detection order for survivors', () => {
    // Three faces: first and third survive; second is rejected. Order must
    // be [first, third], not reversed.
    const f1 = face(0,   0, 100, 100, 0.9);   // no overlap
    const f2 = face(200, 0, 100, 100, 0.8);   // fully covered
    const f3 = face(400, 0, 100, 100, 0.7);   // no overlap
    const tokens = [tok(200, 0, 100, 100)];   // covers f2 only
    const result = rejectFacesCoveredByOCR([f1, f2, f3], tokens);
    expect(result).toHaveLength(2);
    expect(result[0]!.confidence).toBeCloseTo(0.9);
    expect(result[1]!.confidence).toBeCloseTo(0.7);
  });

  it('accepts a custom coverage threshold', () => {
    // At threshold=0.3, a face with 40% coverage is rejected.
    // At threshold=0.5 (default), the same face would be kept.
    const f = face(0, 0, 100, 100, 0.7);
    const tokens = [tok(0, 0, 40, 100)]; // 40% coverage

    expect(rejectFacesCoveredByOCR([f], tokens, 0.3)).toHaveLength(0);
    expect(rejectFacesCoveredByOCR([f], tokens, 0.5)).toHaveLength(1);
  });
});
