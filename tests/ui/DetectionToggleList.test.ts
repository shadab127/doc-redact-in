/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';
import {
  defaultEnabledMap,
  filterEnabledDetections,
  toggleKeyString,
} from '@/src/ui/DetectionToggleList';
import type { Detection } from '@/src/detection/types';

function det(kind: Detection['kind']): Detection {
  return {
    kind,
    bbox: { x: 0, y: 0, w: 100, h: 100 },
    maskBbox: { x: 0, y: 0, w: 100, h: 100 },
    value: 'x',
    confidence: 0.9,
  };
}

describe('toggleKeyString', () => {
  it('produces a stable composite key for (pageIndex, detectionIndex)', () => {
    expect(toggleKeyString({ pageIndex: 0, detectionIndex: 0 })).toBe('0:0');
    expect(toggleKeyString({ pageIndex: 2, detectionIndex: 5 })).toBe('2:5');
  });
});

describe('defaultEnabledMap', () => {
  it('enables aadhaar/pan/mrz/face/uidai_qr by default', () => {
    const pages = [
      {
        pageIndex: 0,
        detections: [det('aadhaar'), det('pan'), det('passport_mrz'), det('face'), det('uidai_qr')],
      },
    ];
    const m = defaultEnabledMap(pages);
    for (let i = 0; i < 5; i++) {
      expect(m.get(`0:${i}`)).toBe(true);
    }
  });

  it('leaves other_qr off by default (RFC §4.7)', () => {
    const pages = [{ pageIndex: 0, detections: [det('other_qr')] }];
    const m = defaultEnabledMap(pages);
    expect(m.get('0:0')).toBe(false);
  });
});

describe('filterEnabledDetections', () => {
  it('passes through only the checked detections, preserving per-page arrays', () => {
    const pages = [
      { pageIndex: 0, detections: [det('aadhaar'), det('face')] },
      { pageIndex: 1, detections: [det('pan'), det('other_qr')] },
    ];
    const enabled = new Map<string, boolean>([
      ['0:0', true],
      ['0:1', false],
      ['1:0', true],
      ['1:1', false],
    ]);
    const filtered = filterEnabledDetections(pages, enabled);
    expect(filtered).toHaveLength(2);
    expect(filtered[0]!.map((d) => d.kind)).toEqual(['aadhaar']);
    expect(filtered[1]!.map((d) => d.kind)).toEqual(['pan']);
  });

  it('returns empty arrays when everything is toggled off', () => {
    const pages = [{ pageIndex: 0, detections: [det('aadhaar')] }];
    const filtered = filterEnabledDetections(pages, new Map([['0:0', false]]));
    expect(filtered[0]).toEqual([]);
  });
});
