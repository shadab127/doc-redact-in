/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';
import { createMockFaceDetectorRunner } from '@/src/detection/FaceDetector';
import type { Detection } from '@/src/detection/types';

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
