/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';
import {
  probeImageRotation,
  scoreTokensAsTextHits,
  PROBE_ROTATIONS,
  type ProbeRotation,
} from '@/src/detection/RotationProbe';
import { verhoeffCheckDigit } from '@/src/detection/Verhoeff';
import type { OCRRunner } from '@/src/detection/OCRRunner';
import type { OCRToken } from '@/src/detection/types';

function mkAadhaar(): string {
  const body = '12345678901';
  return body + String(verhoeffCheckDigit(body));
}

function tok(text: string, x: number, lineId: number): OCRToken {
  return {
    text,
    bbox: { x, y: 10, w: text.length * 10, h: 20 },
    confidence: 0.9,
    lineId,
  };
}

function aadhaarTokens(): OCRToken[] {
  const a = mkAadhaar();
  return [
    tok(a.slice(0, 4), 10, 0),
    tok(a.slice(4, 8), 60, 0),
    tok(a.slice(8, 12), 110, 0),
  ];
}

type Marker = { tag: string };

interface RotationHarness {
  perRotation: Partial<Record<0 | ProbeRotation, OCRToken[]>>;
  seenRotations: (0 | ProbeRotation)[];
}

function mkHarness(perRotation: RotationHarness['perRotation']): {
  ocr: OCRRunner;
  opts: {
    rotate: (s: Marker, rot: 0 | ProbeRotation) => Marker;
    downscale: (s: Marker) => Marker;
  };
  source: Marker;
  seen: (0 | ProbeRotation)[];
} {
  const seen: (0 | ProbeRotation)[] = [];
  // The rotator tags the marker with the requested rotation; the mock OCR
  // runner reads the tag back to decide which token bucket to return. This
  // lets us assert "rotation 180 was probed" without a real canvas.
  const rotate = (_s: Marker, rot: 0 | ProbeRotation): Marker => {
    seen.push(rot);
    return { tag: `rot:${rot}` };
  };
  const downscale = (s: Marker): Marker => s;
  const ocr: OCRRunner = {
    async recognize(input: unknown): Promise<OCRToken[]> {
      const marker = input as Marker;
      const match = /^rot:(\d+)$/.exec(marker.tag);
      const rot = match ? (Number(match[1]) as 0 | ProbeRotation) : 0;
      return perRotation[rot] ?? [];
    },
    async terminate() {},
  };
  return { ocr, opts: { rotate, downscale }, source: { tag: 'rot:0' }, seen };
}

describe('scoreTokensAsTextHits', () => {
  it('counts Verhoeff-valid Aadhaar matches', () => {
    expect(scoreTokensAsTextHits(aadhaarTokens())).toBe(1);
  });

  it('ignores 12-digit strings that fail Verhoeff', () => {
    const tokens: OCRToken[] = [
      tok('1234', 10, 0),
      tok('5678', 60, 0),
      tok('9012', 110, 0),
    ];
    // 123456789012 is not a valid Verhoeff; must score zero so the probe
    // doesn't lock onto random 12-digit strings in garbage OCR output.
    expect(scoreTokensAsTextHits(tokens)).toBe(0);
  });

  it('counts PAN-regex matches', () => {
    const tokens: OCRToken[] = [tok('ABCPE1234F', 10, 0)];
    expect(scoreTokensAsTextHits(tokens)).toBe(1);
  });
});

describe('probeImageRotation', () => {
  it('picks the rotation with Verhoeff-valid Aadhaar hits', async () => {
    const { ocr, opts, source, seen } = mkHarness({
      90: [],
      180: aadhaarTokens(),
      270: [],
    });
    const winning = await probeImageRotation(source, ocr, opts);
    expect(winning).toBe(180);
    expect([...seen].sort((a, b) => a - b)).toEqual([90, 180, 270]);
  });

  it('returns null when no rotation yields text hits', async () => {
    const { ocr, opts, source } = mkHarness({
      90: [tok('hello', 0, 0)],
      180: [tok('world', 0, 0)],
      270: [],
    });
    expect(await probeImageRotation(source, ocr, opts)).toBeNull();
  });

  it('tie-breaks by probe order (180° preferred over 90°/270°)', async () => {
    // All three rotations return the same single valid Aadhaar. The first
    // rotation iterated (180, per PROBE_ROTATIONS) must win because equal
    // scores do not beat the current best.
    const { ocr, opts, source } = mkHarness({
      90: aadhaarTokens(),
      180: aadhaarTokens(),
      270: aadhaarTokens(),
    });
    expect(await probeImageRotation(source, ocr, opts)).toBe(180);
  });

  it('prefers higher hit count over probe order', async () => {
    // 270° returns 2 Aadhaars; 180° only 1. Higher count must win despite
    // 180° being probed first.
    const doubleAadhaar = (): OCRToken[] => {
      const a = mkAadhaar();
      return [
        tok(a.slice(0, 4), 10, 0),
        tok(a.slice(4, 8), 60, 0),
        tok(a.slice(8, 12), 110, 0),
        tok(a.slice(0, 4), 10, 1),
        tok(a.slice(4, 8), 60, 1),
        tok(a.slice(8, 12), 110, 1),
      ];
    };
    const { ocr, opts, source } = mkHarness({
      90: [],
      180: aadhaarTokens(),
      270: doubleAadhaar(),
    });
    expect(await probeImageRotation(source, ocr, opts)).toBe(270);
  });

  it('probes all three rotations in documented order', async () => {
    const { ocr, opts, source, seen } = mkHarness({ 90: [], 180: [], 270: [] });
    await probeImageRotation(source, ocr, opts);
    expect(seen).toEqual([...PROBE_ROTATIONS]);
  });
});
