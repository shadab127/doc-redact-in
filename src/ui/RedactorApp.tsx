/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DropZone } from './DropZone';
import { CameraCapture } from './CameraCapture';
import { useIsMobile } from './useIsMobile';
import {
  DetectionToggleList,
  defaultEnabledMap,
  filterEnabledDetections,
  toggleKeyString,
  type ToggleKey,
} from './DetectionToggleList';
import { PageNavigator } from './PageNavigator';
import { PreviewCanvas } from './PreviewCanvas';
import { redactedFilename, triggerDownload } from './download';
import {
  runDetectionOnDocument,
  type RasterizedPageLike,
} from '@/src/detection/DetectionOrchestrator';
import type { DocumentDetectionResult } from '@/src/detection/types';
import { createFaceDetectorRunner } from '@/src/detection/FaceDetector';
import { createQrDetectorRunner } from '@/src/detection/QrDetector';
import { flattenToImageOnlyPdf } from '@/src/masking/PdfFlattener';
import { friendlyError } from './friendlyError';
import { ErrorDetails, captureRawError, type RawError } from './ErrorDetails';
import { setManualHandoff, type ManualHandoff } from './manual/handoff';
import type { UserBox } from './manual/types';
import {
  getRedactorSession,
  setRedactorSession,
  updateRedactorSession,
} from './redactorSession';

// Hoisted so the face-api model weights and zxing WASM are fetched at most
// once per browser tab — not re-loaded on every file selection.
const sharedFaceRunner = createFaceDetectorRunner();
const sharedQrRunner = createQrDetectorRunner();

type Status = 'idle' | 'running' | 'done' | 'downloading' | 'error';

interface RedactionState {
  result: DocumentDetectionResult;
  rasters: RasterizedPageLike[];
  fileName: string;
  pagePtSizes: Array<{ width: number; height: number }>;
}

async function rasterImage(file: Blob): Promise<RasterizedPageLike> {
  // Apply EXIF Orientation. Phone cameras routinely store portrait photos as
  // landscape pixel data plus an EXIF tag; without `from-image` the browser
  // hands us sideways bytes, and every downstream detector (OCR, face, QR)
  // sees a rotated document. Fixing this recovers a large slice of the
  // "rotated phone photo" failure class.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return { pageIndex: 0, canvas, width: canvas.width, height: canvas.height };
}

async function rasterizeSvgBlobToPngFile(
  blob: Blob,
  filename: string
): Promise<File> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'sync';
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load sample SVG'));
    });
    img.src = url;
    await loaded;
    const w = img.naturalWidth || 640;
    const h = img.naturalHeight || 400;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    ctx.drawImage(img, 0, 0, w, h);
    const pngBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
        'image/png'
      );
    });
    return new File([pngBlob], filename, { type: 'image/png' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function processDocument(
  file: File,
  onStage: (stage: string) => void
): Promise<RedactionState> {
  const face = sharedFaceRunner;
  const qr = sharedQrRunner;
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (isPdf) {
    const { createBrowserPdfPipeline } = await import('@/src/pdf/BrowserPdfPipeline');
    const rasters: RasterizedPageLike[] = [];
    const result = await runDetectionOnDocument(file, {
      face,
      qr,
      pdfPipeline: createBrowserPdfPipeline,
      onRaster: (r) => {
        rasters.push(r);
      },
      onStage: (stage) => onStage(stage),
    });
    const pagePtSizes = Array.from(result.pageSizesPt ?? []);
    return { result, rasters, fileName: file.name, pagePtSizes };
  }
  onStage('Loading image…');
  const raster = await rasterImage(file);
  let effectiveRaster = raster;
  const result = await runDetectionOnDocument(raster.canvas, {
    face,
    qr,
    autoRotateImage: true,
    onRaster: (r) => {
      // Probe fired and rotated the canvas. Swap the raster so preview and
      // PDF flattening operate on the same pixels detections were made on.
      effectiveRaster = r;
    },
    onStage: (stage) => onStage(stage),
  });
  return {
    result,
    rasters: [effectiveRaster],
    fileName: file.name,
    pagePtSizes: [
      { width: effectiveRaster.width * 0.75, height: effectiveRaster.height * 0.75 },
    ],
  };
}

export interface RedactorAppProps {
  /** URL of a sample file to load when the user clicks "Try a sample ID". */
  sampleUrl?: string;
}

function seedBoxId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function RedactorApp({ sampleUrl }: RedactorAppProps = {}) {
  // Hydrate from the module-level store so the auto-detect result view
  // survives navigating to /manual and back. Cleared only via "Start over".
  const initial = getRedactorSession();

  const [status, setStatus] = useState<Status>(initial ? 'done' : 'idle');
  const [state, setState] = useState<RedactionState | null>(() =>
    initial
      ? {
          result: initial.result,
          rasters: initial.rasters,
          fileName: initial.fileName,
          pagePtSizes: initial.pagePtSizes,
        }
      : null
  );
  const [error, setError] = useState<{ friendly: string; raw: RawError } | null>(null);
  const [enabled, setEnabledLocal] = useState<Map<string, boolean>>(
    () => (initial ? new Map(initial.enabled) : new Map())
  );
  const [previewPageIndex, setPreviewPageIndexLocal] = useState<number>(
    initial?.previewPageIndex ?? 0
  );
  const [stage, setStage] = useState<string>('');
  const isMobile = useIsMobile();
  const router = useRouter();
  const busy = status === 'running' || status === 'downloading';

  const onFile = async (file: File) => {
    setStatus('running');
    setError(null);
    setState(null);
    setPreviewPageIndexLocal(0);
    setStage('');
    try {
      const next = await processDocument(file, setStage);
      const defaultEnabled = defaultEnabledMap(next.result.pages);
      setState(next);
      setEnabledLocal(defaultEnabled);
      setRedactorSession({
        result: next.result,
        rasters: next.rasters,
        fileName: next.fileName,
        pagePtSizes: next.pagePtSizes,
        enabled: defaultEnabled,
        previewPageIndex: 0,
      });
      setStatus('done');
    } catch (e) {
      setError({ friendly: friendlyError(e), raw: captureRawError(e) });
      setStatus('error');
    }
  };

  const startOver = () => {
    setRedactorSession(null);
    setStatus('idle');
    setState(null);
    setEnabledLocal(new Map());
    setPreviewPageIndexLocal(0);
    setStage('');
    setError(null);
  };

  const setPreviewPageIndex = (next: number) => {
    setPreviewPageIndexLocal(next);
    updateRedactorSession({ previewPageIndex: next });
  };

  const loadSample = async () => {
    if (!sampleUrl || busy) return;
    try {
      const resp = await fetch(sampleUrl);
      if (!resp.ok) throw new Error(`Failed to fetch sample: ${resp.status}`);
      const blob = await resp.blob();
      // createImageBitmap rejects SVG on Chromium, so rasterize to PNG via
      // <img> + canvas before feeding the detection pipeline.
      const isSvg =
        blob.type.includes('svg') || /\.svg$/i.test(sampleUrl);
      const file = isSvg
        ? await rasterizeSvgBlobToPngFile(blob, 'sample-aadhaar.png')
        : new File([blob], sampleUrl.split('/').pop() ?? 'sample.jpg', {
            type: blob.type || 'image/jpeg',
          });
      await onFile(file);
    } catch (e) {
      setError({ friendly: friendlyError(e), raw: captureRawError(e) });
      setStatus('error');
    }
  };

  const onToggle = (k: ToggleKey, value: boolean) => {
    setEnabledLocal((prev) => {
      const next = new Map(prev);
      next.set(toggleKeyString(k), value);
      updateRedactorSession({ enabled: next });
      return next;
    });
  };

  const openInManualMode = () => {
    if (!state) return;
    const filteredPerPage = filterEnabledDetections(state.result.pages, enabled);
    const pages = state.rasters.map((r, idx) => {
      const pt = state.pagePtSizes[idx] ?? { width: r.width * 0.75, height: r.height * 0.75 };
      return {
        canvas: r.canvas,
        width: r.width,
        height: r.height,
        widthPt: pt.width,
        heightPt: pt.height,
      };
    });
    const seedBoxes = new Map<number, UserBox[]>();
    filteredPerPage.forEach((detections, idx) => {
      const boxes: UserBox[] = detections.map((d) => ({
        id: seedBoxId(),
        x: d.maskBbox.x,
        y: d.maskBbox.y,
        w: d.maskBbox.w,
        h: d.maskBbox.h,
      }));
      seedBoxes.set(idx, boxes);
    });
    const handoff: ManualHandoff = {
      fileName: state.fileName,
      pages,
      seedBoxes,
    };
    setManualHandoff(handoff);
    router.push('/manual');
  };

  const download = async () => {
    if (!state) return;
    setStatus('downloading');
    try {
      const filteredPerPage = filterEnabledDetections(state.result.pages, enabled);
      const pages = state.rasters.map((r, idx) => {
        const pt = state.pagePtSizes[idx] ?? { width: r.width * 0.75, height: r.height * 0.75 };
        return {
          canvas: r.canvas,
          widthPt: pt.width,
          heightPt: pt.height,
          detections: filteredPerPage[idx] ?? [],
        };
      });
      const pdfBytes = await flattenToImageOnlyPdf(pages);
      triggerDownload(pdfBytes, redactedFilename(state.fileName));
      setStatus('done');
    } catch (e) {
      setError({ friendly: friendlyError(e), raw: captureRawError(e) });
      setStatus('error');
    }
  };

  const totalDetections =
    state?.result.pages.reduce((n, p) => n + p.detections.length, 0) ?? 0;
  const enabledCount =
    state?.result.pages.reduce(
      (n, p) =>
        n +
        p.detections.reduce((m, _, i) => {
          const on = enabled.get(toggleKeyString({ pageIndex: p.pageIndex, detectionIndex: i }));
          return m + (on ? 1 : 0);
        }, 0),
      0
    ) ?? 0;

  const previewPage = state?.result.pages[previewPageIndex] ?? null;
  const previewRaster = state?.rasters[previewPageIndex] ?? null;
  const previewEnabledFlags = useMemo<boolean[]>(() => {
    if (!previewPage) return [];
    return previewPage.detections.map(
      (_, i) =>
        enabled.get(toggleKeyString({ pageIndex: previewPage.pageIndex, detectionIndex: i })) ??
        false
    );
  }, [previewPage, enabled]);

  return (
    <section style={{ marginTop: 24 }}>
      {isMobile === null ? null : isMobile ? (
        <>
          <CameraCapture onFile={onFile} disabled={busy} />
          <div style={{ marginTop: 12 }}>
            <DropZone onFile={onFile} disabled={busy} />
          </div>
          {sampleUrl && (
            <div style={{ marginTop: 10, textAlign: 'center' }}>
              <button
                onClick={loadSample}
                disabled={busy}
                data-testid="try-sample-btn"
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 10,
                  color: 'var(--fg)',
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '8px 16px',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.5 : 1,
                }}
              >
                Try a sample ID →
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <DropZone onFile={onFile} disabled={busy} />
          {sampleUrl && (
            <div style={{ marginTop: 10, textAlign: 'center' }}>
              <button
                onClick={loadSample}
                disabled={busy}
                data-testid="try-sample-btn"
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 10,
                  color: 'var(--fg)',
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '8px 16px',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.5 : 1,
                }}
              >
                Try a sample ID →
              </button>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 16, fontSize: 14, color: 'var(--muted)' }}>
        {status === 'idle' && 'Choose a file to begin.'}
        {status === 'running' && (
        <>
          <div>{`Scanning ${state?.fileName ?? ''}…`}</div>
          {stage && (
            <div style={{ fontSize: 12, marginTop: 4, color: 'var(--muted)' }}>{stage}</div>
          )}
        </>
      )}
        {status === 'downloading' && 'Building flattened PDF…'}
        {status === 'error' && error && (
          <>
            <div>{error.friendly}</div>
            <ErrorDetails raw={error.raw} />
          </>
        )}
        {status === 'done' && state && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <span>
                Found <strong>{totalDetections}</strong> detection
                {totalDetections === 1 ? '' : 's'} across {state.result.pages.length} page
                {state.result.pages.length === 1 ? '' : 's'} in {state.result.totalElapsedMs} ms.
              </span>
              <button
                type="button"
                onClick={startOver}
                data-testid="redactor-start-over-btn"
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 8,
                  color: 'var(--fg)',
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '6px 12px',
                  cursor: 'pointer',
                }}
              >
                Start over
              </button>
            </div>
            {state.result.pages.length > 1 && (
              <PageNavigator
                pageIndex={previewPageIndex}
                totalPages={state.result.pages.length}
                onPageChange={setPreviewPageIndex}
              />
            )}
            {previewRaster && previewPage && (
              <div style={{ marginTop: 12, marginBottom: 12 }}>
                <PreviewCanvas
                  raster={previewRaster}
                  detections={previewPage.detections}
                  enabledFlags={previewEnabledFlags}
                />
              </div>
            )}
            <DetectionToggleList
              pages={state.result.pages}
              enabled={enabled}
              onToggle={onToggle}
            />
            <div style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 10, fontSize: 13 }}>
                <button
                  type="button"
                  onClick={openInManualMode}
                  data-testid="open-manual-mode-btn"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    color: 'var(--brand, #a78bfa)',
                    cursor: 'pointer',
                    fontSize: 13,
                    textDecoration: 'underline',
                    textUnderlineOffset: 2,
                  }}
                >
                  Missed something? Open in manual mode →
                </button>
              </div>
              <button
                onClick={download}
                style={{
                  padding: '12px 20px',
                  background: 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '0.01em',
                  cursor: 'pointer',
                  boxShadow: '0 10px 24px -12px rgba(124, 58, 237, 0.7), inset 0 1px 0 rgba(255,255,255,0.15)',
                }}
              >
                Download redacted PDF ({enabledCount} masked)
              </button>
              <div style={{ fontSize: 12, marginTop: 6 }}>
                Image-only output — no searchable text, larger file. Verify before
                sharing.
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
