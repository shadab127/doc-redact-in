/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';
import { createMockQrDetectorRunner } from '@/src/detection/QrDetector';
import type { Detection } from '@/src/detection/types';

describe('createMockQrDetectorRunner', () => {
  it('echoes the provided detections, matching the real runner\'s shape', async () => {
    const fake: Detection[] = [
      {
        kind: 'uidai_qr',
        bbox: { x: 10, y: 10, w: 100, h: 100 },
        maskBbox: { x: 10, y: 10, w: 100, h: 100 },
        value: '<?xml...PrintLetterBarcodeData ...>',
        confidence: 1,
      },
    ];
    const runner = createMockQrDetectorRunner(fake);
    const out = await runner.detect({ width: 1000, height: 800 } as unknown as HTMLCanvasElement);
    expect(out).toEqual(fake);
  });
});
