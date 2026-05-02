/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
'use client';

import { useEffect, useRef } from 'react';
import type { Detection, DetectionKind } from '@/src/detection/types';
import type { RasterizedPageLike } from '@/src/detection/DetectionOrchestrator';

const KIND_STROKE: Record<DetectionKind, string> = {
  aadhaar: '#ff9f43',
  pan: '#ff6b6b',
  passport_mrz: '#ff9f43',
  face: '#7cc4ff',
  uidai_qr: '#5bd170',
  other_qr: '#9a9aa2',
};

export interface PreviewCanvasProps {
  raster: RasterizedPageLike;
  detections: readonly Detection[];
  enabledFlags: readonly boolean[];
  highlightIndex?: number;
  maxDisplayWidth?: number;
}

export function PreviewCanvas({
  raster,
  detections,
  enabledFlags,
  highlightIndex,
  maxDisplayWidth = 720,
}: PreviewCanvasProps) {
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const scale = Math.min(1, maxDisplayWidth / raster.width);
  const displayWidth = Math.round(raster.width * scale);
  const displayHeight = Math.round(raster.height * scale);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.width = displayWidth;
    overlay.height = displayHeight;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    detections.forEach((d, i) => {
      const enabled = enabledFlags[i] ?? false;
      const isHighlight = i === highlightIndex;
      const stroke = KIND_STROKE[d.kind];
      ctx.strokeStyle = stroke;
      ctx.lineWidth = isHighlight ? 3 : 2;
      ctx.setLineDash(enabled ? [] : [6, 4]);
      ctx.globalAlpha = enabled ? 1 : 0.55;
      ctx.strokeRect(
        d.bbox.x * scale,
        d.bbox.y * scale,
        d.bbox.w * scale,
        d.bbox.h * scale
      );
    });
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }, [detections, enabledFlags, highlightIndex, displayWidth, displayHeight, scale]);

  // Draw the source raster onto a sibling canvas that fills the same space;
  // we use CSS absolute positioning to stack the overlay on top of the image.
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const dest = sourceRef.current;
    if (!dest) return;
    dest.width = displayWidth;
    dest.height = displayHeight;
    const ctx = dest.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(raster.canvas, 0, 0, displayWidth, displayHeight);
  }, [raster.canvas, displayWidth, displayHeight]);

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        width: displayWidth,
        height: displayHeight,
        maxWidth: '100%',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#111318',
      }}
      aria-label="Document preview with detection overlays"
    >
      <canvas
        ref={sourceRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      <canvas
        ref={overlayRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
    </div>
  );
}
