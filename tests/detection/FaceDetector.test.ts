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
} from '@/src/detection/FaceDetector';
import type { Detection } from '@/src/detection/types';

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
