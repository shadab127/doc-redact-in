/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';
import {
  fitWithin,
  toGrayscale,
  otsuThreshold,
  applyOtsu,
  applyClaheGlobal,
  gaussianBlur3x3,
  preprocessForOCR,
} from '@/src/detection/ImagePreprocessor';

function rgbaSolid(width: number, height: number, r: number, g: number, b: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = 255;
  }
  return out;
}

function rgbaBimodal(n: number, aCount: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const v = i < aCount ? 40 : 220;
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
}

describe('fitWithin', () => {
  it('returns scale=1 when below maxLongEdge', () => {
    expect(fitWithin(1000, 800, 2400)).toEqual({ width: 1000, height: 800, scale: 1 });
  });

  it('scales down preserving aspect ratio', () => {
    const out = fitWithin(4800, 3600, 2400);
    expect(out.width).toBe(2400);
    expect(out.height).toBe(1800);
    expect(out.scale).toBeCloseTo(0.5);
  });

  it('scales when only one edge exceeds the cap', () => {
    const out = fitWithin(5000, 500, 2400);
    expect(out.width).toBe(2400);
    expect(out.height).toBe(240);
  });
});

describe('toGrayscale', () => {
  it('produces identical R=G=B per pixel', () => {
    const rgba = rgbaSolid(2, 2, 200, 100, 50);
    const gray = toGrayscale(rgba);
    for (let i = 0; i < gray.length; i += 4) {
      expect(gray[i]).toBe(gray[i + 1]);
      expect(gray[i + 1]).toBe(gray[i + 2]);
    }
  });

  it('applies BT.601 weights (0.299, 0.587, 0.114)', () => {
    const gray = toGrayscale(rgbaSolid(1, 1, 255, 0, 0));
    expect(gray[0]).toBe(Math.round(0.299 * 255));
  });

  it('preserves alpha channel', () => {
    const rgba = new Uint8ClampedArray([100, 100, 100, 123]);
    expect(toGrayscale(rgba)[3]).toBe(123);
  });
});

describe('otsuThreshold', () => {
  it('splits a bimodal image between the two modes', () => {
    const gray = rgbaBimodal(1000, 500);
    const t = otsuThreshold(gray);
    expect(t).toBeGreaterThanOrEqual(40);
    expect(t).toBeLessThan(220);
  });

  it('yields a threshold that partitions the image consistently', () => {
    const gray = rgbaBimodal(1000, 500);
    const t = otsuThreshold(gray);
    const bin = applyOtsu(gray, t);
    let white = 0;
    let black = 0;
    for (let i = 0; i < bin.length; i += 4) {
      if (bin[i] === 255) white++;
      else black++;
    }
    // With modes at 40/220 and t in [40,220), pixels at 40 go black and 220 go white.
    expect(black).toBeGreaterThan(0);
    expect(white).toBeGreaterThan(0);
  });
});

describe('applyOtsu', () => {
  it('maps pixels to pure black or white', () => {
    const gray = rgbaBimodal(100, 50);
    const bin = applyOtsu(gray);
    for (let i = 0; i < bin.length; i += 4) {
      expect(bin[i] === 0 || bin[i] === 255).toBe(true);
    }
  });
});

describe('applyClaheGlobal', () => {
  it('stretches contrast: output range strictly wider than the input range', () => {
    const lowContrast = new Uint8ClampedArray(400);
    for (let i = 0; i < 100; i++) {
      const v = 100 + (i % 20);
      lowContrast[i * 4] = v;
      lowContrast[i * 4 + 1] = v;
      lowContrast[i * 4 + 2] = v;
      lowContrast[i * 4 + 3] = 255;
    }
    const inRange = 19; // 100..119
    const out = applyClaheGlobal(lowContrast);
    let min = 255;
    let max = 0;
    for (let i = 0; i < out.length; i += 4) {
      if (out[i]! < min) min = out[i]!;
      if (out[i]! > max) max = out[i]!;
    }
    expect(max - min).toBeGreaterThan(inRange);
  });
});

describe('gaussianBlur3x3', () => {
  it('is a no-op on a solid image', () => {
    const rgba = rgbaSolid(3, 3, 128, 128, 128);
    const out = gaussianBlur3x3(rgba, 3, 3);
    for (let i = 0; i < out.length; i += 4) expect(out[i]).toBe(128);
  });

  it('reduces variance on a noisy row', () => {
    const w = 5;
    const h = 3;
    const src = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < src.length; i += 4) {
      src[i] = src[i + 1] = src[i + 2] = 128;
      src[i + 3] = 255;
    }
    // Center pixel spike.
    const cIdx = (1 * w + 2) * 4;
    src[cIdx] = src[cIdx + 1] = src[cIdx + 2] = 255;
    const out = gaussianBlur3x3(src, w, h);
    expect(out[cIdx]).toBeLessThan(255);
    expect(out[cIdx]).toBeGreaterThan(128);
  });
});

describe('preprocessForOCR', () => {
  it('default pipeline returns grayscale pixels (R=G=B)', () => {
    const rgba = rgbaSolid(4, 4, 200, 100, 50);
    const out = preprocessForOCR({ data: rgba, width: 4, height: 4 });
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(out.data[i + 1]);
    }
  });

  it('applyOtsu: true returns a binarized image and a threshold', () => {
    const rgba = rgbaBimodal(400, 200);
    const out = preprocessForOCR(
      { data: rgba, width: 20, height: 20 },
      { applyOtsu: true, applyClahe: false }
    );
    expect(out.threshold).toBeGreaterThan(0);
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i] === 0 || out.data[i] === 255).toBe(true);
    }
  });
});
