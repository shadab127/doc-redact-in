/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  renderMasks,
  _internal,
  type RenderableCanvas,
} from '@/src/masking/CanvasMaskRenderer';
import type { Detection } from '@/src/detection/types';

type FillRectCall = [number, number, number, number];

function mockCanvas(width = 1000, height = 800) {
  const fills: FillRectCall[] = [];
  const filters: string[] = [];
  const drawImageCalls: unknown[] = [];
  let fillStyle: string | CanvasGradient | CanvasPattern = '';
  let currentFilter = 'none';

  const ctx = {
    get fillStyle() { return fillStyle; },
    set fillStyle(v: string | CanvasGradient | CanvasPattern) { fillStyle = v; },
    get filter() { return currentFilter; },
    set filter(v: string) { currentFilter = v; filters.push(v); },
    fillRect: (x: number, y: number, w: number, h: number) => {
      fills.push([x, y, w, h]);
    },
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    drawImage: (...args: unknown[]) => { drawImageCalls.push(args); },
  } as unknown as CanvasRenderingContext2D;

  const canvas: RenderableCanvas = {
    width,
    height,
    getContext: (id: '2d') => (id === '2d' ? ctx : null),
  };
  return { canvas, fills, filters, drawImageCalls };
}

function det(kind: Detection['kind'], bbox = { x: 100, y: 100, w: 200, h: 40 }): Detection {
  return { kind, bbox, maskBbox: bbox, value: 'x', confidence: 0.9 };
}

describe('renderMasks', () => {
  it('draws a solid rectangle for Aadhaar', () => {
    const { canvas, fills } = mockCanvas();
    renderMasks(canvas, [det('aadhaar')]);
    expect(fills).toEqual([[100, 100, 200, 40]]);
  });

  it('draws solid rectangles for pan and passport_mrz', () => {
    const { canvas, fills } = mockCanvas();
    renderMasks(canvas, [det('pan'), det('passport_mrz', { x: 0, y: 0, w: 50, h: 10 })]);
    expect(fills).toHaveLength(2);
  });

  it('adds 5px padding for UIDAI QR', () => {
    const { canvas, fills } = mockCanvas();
    renderMasks(canvas, [det('uidai_qr', { x: 100, y: 100, w: 50, h: 50 })]);
    expect(fills[0]).toEqual([95, 95, 60, 60]);
  });

  it('never masks other_qr by default', () => {
    const { canvas, fills, drawImageCalls } = mockCanvas();
    renderMasks(canvas, [det('other_qr')]);
    expect(fills).toEqual([]);
    expect(drawImageCalls).toEqual([]);
  });

  it('draws a solid rectangle for face (expanded 15%)', () => {
    const { canvas, fills, filters, drawImageCalls } = mockCanvas();
    // 100x100 face -> dx=dy=15, so expanded box is 385,285,130,130
    renderMasks(canvas, [det('face', { x: 400, y: 300, w: 100, h: 100 })]);
    expect(fills).toEqual([[385, 285, 130, 130]]);
    expect(drawImageCalls).toEqual([]);
    expect(filters.filter((f) => f.startsWith('blur'))).toEqual([]);
  });

  it('clamps padded boxes to the canvas bounds', () => {
    const { canvas, fills } = mockCanvas(50, 50);
    renderMasks(canvas, [det('uidai_qr', { x: 0, y: 0, w: 50, h: 50 })]);
    const f = fills[0]!;
    expect(f[0]).toBe(0);
    expect(f[1]).toBe(0);
    expect(f[2]).toBe(50);
    expect(f[3]).toBe(50);
  });

  it('throws if a 2D context cannot be acquired', () => {
    const canvas: RenderableCanvas = {
      width: 10,
      height: 10,
      getContext: () => null,
    };
    expect(() => renderMasks(canvas, [det('aadhaar')])).toThrow(/2D context/);
  });
});

describe('internal helpers', () => {
  it('expandFraction applies per-axis padding (15% of width on x, 15% of height on y)', () => {
    const b = _internal.expandFraction({ x: 100, y: 100, w: 100, h: 200 }, 0.15, 1000, 1000);
    // dx = 15, dy = 30
    expect(b.x).toBe(85);
    expect(b.y).toBe(70);
    expect(b.w).toBe(130);
    expect(b.h).toBe(260);
  });

  it('expandFraction clamps to canvas bounds', () => {
    const b = _internal.expandFraction({ x: 0, y: 0, w: 100, h: 200 }, 0.5, 120, 220);
    expect(b.x).toBe(0);
    expect(b.y).toBe(0);
    expect(b.w).toBe(120);
    expect(b.h).toBe(220);
  });
});
