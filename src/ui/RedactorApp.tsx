/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
'use client';

import { useState } from 'react';
import { DropZone } from './DropZone';
import { redactedFilename, triggerDownload } from './download';
import {
  runDetectionOnDocument,
  type RasterizedPageLike,
} from '@/src/detection/DetectionOrchestrator';
import type { DocumentDetectionResult } from '@/src/detection/types';
import { flattenToImageOnlyPdf } from '@/src/masking/PdfFlattener';

type Status = 'idle' | 'running' | 'done' | 'downloading' | 'error';

interface RedactionState {
  result: DocumentDetectionResult;
  rasters: RasterizedPageLike[];
  fileName: string;
  pagePtSizes: Array<{ width: number; height: number }>;
}

async function rasterImage(file: Blob): Promise<RasterizedPageLike> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return { pageIndex: 0, canvas, width: canvas.width, height: canvas.height };
}

async function processDocument(file: File): Promise<RedactionState> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (isPdf) {
    const { createBrowserPdfPipeline } = await import('@/src/pdf/BrowserPdfPipeline');
    const rasters: RasterizedPageLike[] = [];
    const result = await runDetectionOnDocument(file, {
      pdfPipeline: createBrowserPdfPipeline,
      onRaster: (r) => {
        rasters.push(r);
      },
    });
    const pagePtSizes = Array.from(result.pageSizesPt ?? []);
    return { result, rasters, fileName: file.name, pagePtSizes };
  }
  const raster = await rasterImage(file);
  const result = await runDetectionOnDocument(file);
  return {
    result,
    rasters: [raster],
    fileName: file.name,
    pagePtSizes: [{ width: raster.width * 0.75, height: raster.height * 0.75 }],
  };
}

export function RedactorApp() {
  const [status, setStatus] = useState<Status>('idle');
  const [state, setState] = useState<RedactionState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setStatus('running');
    setError(null);
    setState(null);
    try {
      const next = await processDocument(file);
      setState(next);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  };

  const download = async () => {
    if (!state) return;
    setStatus('downloading');
    try {
      const pages = state.rasters.map((r, idx) => {
        const pt = state.pagePtSizes[idx] ?? { width: r.width * 0.75, height: r.height * 0.75 };
        return {
          canvas: r.canvas,
          widthPt: pt.width,
          heightPt: pt.height,
          detections: state.result.pages[idx]?.detections ?? [],
        };
      });
      const pdfBytes = await flattenToImageOnlyPdf(pages);
      triggerDownload(pdfBytes, redactedFilename(state.fileName));
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  };

  const totalDetections =
    state?.result.pages.reduce((n, p) => n + p.detections.length, 0) ?? 0;

  return (
    <section style={{ marginTop: 24 }}>
      <DropZone
        onFile={onFile}
        disabled={status === 'running' || status === 'downloading'}
      />
      <div style={{ marginTop: 16, fontSize: 14, color: 'var(--muted)' }}>
        {status === 'idle' && 'Choose a file to begin.'}
        {status === 'running' && `Scanning ${state?.fileName ?? ''}…`}
        {status === 'downloading' && 'Building flattened PDF…'}
        {status === 'error' && `Error: ${error}`}
        {status === 'done' && state && (
          <>
            Found <strong>{totalDetections}</strong> detection
            {totalDetections === 1 ? '' : 's'} across {state.result.pages.length} page
            {state.result.pages.length === 1 ? '' : 's'} in {state.result.totalElapsedMs} ms.
            <div style={{ marginTop: 12 }}>
              <button
                onClick={download}
                style={{
                  padding: '10px 16px',
                  background: 'var(--accent)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Download redacted PDF
              </button>
              <div style={{ fontSize: 12, marginTop: 6 }}>
                Image-only output — no searchable text, larger file. Verify before sharing.
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
