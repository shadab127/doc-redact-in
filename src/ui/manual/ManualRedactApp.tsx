/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DropZone } from '../DropZone';
import { PageNavigator } from '../PageNavigator';
import { redactedFilename, triggerDownload } from '../download';
import { friendlyError } from '../friendlyError';
import { ErrorDetails, captureRawError, type RawError } from '../ErrorDetails';
import { flattenToImageOnlyPdf } from '@/src/masking/PdfFlattener';
import { ManualRedactCanvas } from './ManualRedactCanvas';
import type { UserBox } from './types';
import {
  consumeManualHandoff,
  peekManualHandoff,
  subscribeManualHandoff,
  type ManualHandoff,
} from './handoff';
import { ConfirmReplaceModal } from './ConfirmReplaceModal';
import {
  getManualSession,
  setManualSession,
  updateManualSession,
  type ManualSession,
} from './manualSession';

interface RasterPage {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  widthPt: number;
  heightPt: number;
}

interface ManualState {
  fileName: string;
  pages: RasterPage[];
}

type Status = 'idle' | 'loading' | 'ready' | 'exporting' | 'error';

const PDF_RASTER_SCALE = 2;

async function loadImageToRaster(file: Blob): Promise<RasterPage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return {
    canvas,
    width: canvas.width,
    height: canvas.height,
    widthPt: canvas.width * 0.75,
    heightPt: canvas.height * 0.75,
  };
}

async function loadPdfToRasters(file: File): Promise<RasterPage[]> {
  const { loadPdf } = await import('@/src/pdf/PdfLoader');
  const { rasterizePage } = await import('@/src/pdf/PdfPageRasterizer');
  const buffer = await file.arrayBuffer();
  const doc = await loadPdf(buffer);
  const pages: RasterPage[] = [];
  try {
    for (let i = 0; i < doc.numPages; i++) {
      const page = await doc.getPage(i + 1);
      const vp = page.getViewport({ scale: 1 });
      const raster = await rasterizePage(page, i, { scale: PDF_RASTER_SCALE });
      pages.push({
        canvas: raster.canvas,
        width: raster.width,
        height: raster.height,
        widthPt: vp.width,
        heightPt: vp.height,
      });
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}

function drawBoxesOntoCanvas(canvas: HTMLCanvasElement, boxes: readonly UserBox[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.save();
  ctx.fillStyle = '#000000';
  for (const b of boxes) {
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }
  ctx.restore();
}

function handoffToSession(handoff: ManualHandoff): ManualSession {
  return {
    fileName: handoff.fileName,
    pages: handoff.pages.map((p) => ({
      canvas: p.canvas,
      width: p.width,
      height: p.height,
      widthPt: p.widthPt,
      heightPt: p.heightPt,
    })),
    boxesByPage: new Map(handoff.seedBoxes),
    pageIndex: 0,
    dirty: false,
  };
}

export function ManualRedactApp() {
  // Initial state comes from the module-level store so navigating back to /
  // and returning preserves the canvas + boxes + dirty flag.
  //
  // Handoff arrival at mount time has three cases:
  //   1. No existing session, handoff pending → consume + apply.
  //   2. Existing session is clean → consume + apply (overwrite silently).
  //   3. Existing session has dirty edits + handoff pending → do NOT consume;
  //      show the modal and let the user choose. (The handoff stays pending
  //      in the singleton until Keep or Replace is clicked.)
  const { initialSession, initialPending } = (() => {
    const existing = getManualSession();
    const pending = peekManualHandoff();
    if (!pending) {
      return { initialSession: existing, initialPending: null };
    }
    if (!existing || !existing.dirty) {
      consumeManualHandoff();
      const fromHandoff = handoffToSession(pending);
      setManualSession(fromHandoff);
      return { initialSession: fromHandoff, initialPending: null };
    }
    // Dirty existing session — defer, open modal.
    return { initialSession: existing, initialPending: pending };
  })();

  const [status, setStatus] = useState<Status>(initialSession ? 'ready' : 'idle');
  const [state, setStateLocal] = useState<ManualState | null>(() =>
    initialSession
      ? { fileName: initialSession.fileName, pages: initialSession.pages }
      : null
  );
  const [boxesByPage, setBoxesByPageLocal] = useState<Map<number, UserBox[]>>(
    () => (initialSession ? new Map(initialSession.boxesByPage) : new Map())
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pageIndex, setPageIndexLocal] = useState(initialSession?.pageIndex ?? 0);
  const [error, setError] = useState<{ friendly: string; raw: RawError } | null>(null);
  const [pendingHandoff, setPendingHandoff] = useState<ManualHandoff | null>(
    initialPending
  );
  const dirtyRef = useRef<boolean>(initialSession?.dirty ?? false);

  const busy = status === 'loading' || status === 'exporting';

  // Apply a ManualSession — shared by file-upload, handoff-apply, and
  // handoff-replace code paths. Writes through to both React state and the
  // module store so both survive an unmount.
  const applySession = useCallback((next: ManualSession) => {
    setManualSession(next);
    setStateLocal({ fileName: next.fileName, pages: next.pages });
    setBoxesByPageLocal(new Map(next.boxesByPage));
    setSelectedId(null);
    setPageIndexLocal(next.pageIndex);
    dirtyRef.current = next.dirty;
    setStatus('ready');
  }, []);

  const onFile = useCallback(
    async (file: File) => {
      setStatus('loading');
      setError(null);
      try {
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        const pages = isPdf ? await loadPdfToRasters(file) : [await loadImageToRaster(file)];
        applySession({
          fileName: file.name,
          pages,
          boxesByPage: new Map(),
          pageIndex: 0,
          dirty: false,
        });
      } catch (e) {
        setError({ friendly: friendlyError(e), raw: captureRawError(e) });
        setStatus('error');
      }
    },
    [applySession]
  );

  // While mounted, watch for a new handoff arriving (user navigated back to
  // /, clicked the link again, returned here). If dirty, show modal;
  // otherwise apply silently. The mount-time consume happens in the
  // initializer above, so this effect only fires for subsequent arrivals.
  useEffect(() => {
    return subscribeManualHandoff(() => {
      const incoming = peekManualHandoff();
      if (!incoming) return;
      if (dirtyRef.current) {
        setPendingHandoff(incoming);
        return;
      }
      consumeManualHandoff();
      applySession(handoffToSession(incoming));
    });
  }, [applySession]);

  const onKeepEdits = useCallback(() => {
    // Discard the incoming handoff; keep the user's current manual state.
    consumeManualHandoff();
    setPendingHandoff(null);
  }, []);

  const onReplaceEdits = useCallback(() => {
    const incoming = consumeManualHandoff();
    setPendingHandoff(null);
    if (!incoming) return;
    applySession(handoffToSession(incoming));
  }, [applySession]);

  const reset = useCallback(() => {
    setManualSession(null);
    setStatus('idle');
    setStateLocal(null);
    setBoxesByPageLocal(new Map());
    setSelectedId(null);
    setPageIndexLocal(0);
    setError(null);
    dirtyRef.current = false;
  }, []);

  const onBoxesChange = useCallback(
    (next: UserBox[]) => {
      setBoxesByPageLocal((prev) => {
        const m = new Map(prev);
        m.set(pageIndex, next);
        updateManualSession({ boxesByPage: m, dirty: true });
        return m;
      });
      // Any edit — draw, delete, move, resize — makes the state dirty so a
      // subsequent handoff will prompt before overwriting.
      dirtyRef.current = true;
    },
    [pageIndex]
  );

  const onSelect = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const onPageChange = useCallback((next: number) => {
    setPageIndexLocal(next);
    setSelectedId(null);
    updateManualSession({ pageIndex: next });
  }, []);

  const download = useCallback(async () => {
    if (!state) return;
    setStatus('exporting');
    setError(null);
    try {
      const pages = state.pages.map((p, idx) => {
        const boxes = boxesByPage.get(idx) ?? [];
        drawBoxesOntoCanvas(p.canvas, boxes);
        return {
          canvas: p.canvas,
          widthPt: p.widthPt,
          heightPt: p.heightPt,
          detections: [],
        };
      });
      const bytes = await flattenToImageOnlyPdf(pages);
      triggerDownload(bytes, redactedFilename(state.fileName));
      setStatus('ready');
    } catch (e) {
      setError({ friendly: friendlyError(e), raw: captureRawError(e) });
      setStatus('error');
    }
  }, [boxesByPage, state]);

  const currentPage = state?.pages[pageIndex] ?? null;
  const currentBoxes = boxesByPage.get(pageIndex) ?? [];
  const totalBoxes = Array.from(boxesByPage.values()).reduce((n, arr) => n + arr.length, 0);

  return (
    <section style={{ marginTop: 24 }}>
      {!state ? (
        <>
          <DropZone onFile={onFile} disabled={busy} />
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
            {status === 'idle' && 'Upload an image or PDF to start drawing manual redaction boxes.'}
            {status === 'loading' && 'Loading document…'}
            {status === 'error' && error && (
              <>
                <div>{error.friendly}</div>
                <ErrorDetails raw={error.raw} />
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {state.fileName} · {totalBoxes} box{totalBoxes === 1 ? '' : 'es'} across{' '}
              {state.pages.length} page{state.pages.length === 1 ? '' : 's'}
            </div>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              style={{
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                color: 'var(--fg)',
                fontSize: 12,
                fontWeight: 500,
                padding: '6px 12px',
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              Start over
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
            Drag on the page to draw a box. Tap a box to select it, then drag to move, drag
            handles to resize, or press <kbd>×</kbd> / <kbd>Delete</kbd> to remove it.
          </div>
          {state.pages.length > 1 && (
            <PageNavigator
              pageIndex={pageIndex}
              totalPages={state.pages.length}
              onPageChange={onPageChange}
            />
          )}
          {currentPage && (
            <ManualRedactCanvas
              raster={currentPage}
              boxes={currentBoxes}
              selectedId={selectedId}
              onBoxesChange={onBoxesChange}
              onSelect={onSelect}
            />
          )}
          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={download}
              disabled={busy || totalBoxes === 0}
              data-testid="manual-export-btn"
              style={{
                padding: '12px 20px',
                background:
                  busy || totalBoxes === 0
                    ? '#3f3f46'
                    : 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.01em',
                cursor: busy || totalBoxes === 0 ? 'not-allowed' : 'pointer',
                boxShadow:
                  busy || totalBoxes === 0
                    ? 'none'
                    : '0 10px 24px -12px rgba(124, 58, 237, 0.7), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              {status === 'exporting'
                ? 'Building PDF…'
                : `Download redacted PDF (${totalBoxes} box${totalBoxes === 1 ? '' : 'es'})`}
            </button>
            <div style={{ fontSize: 12, marginTop: 6, color: 'var(--muted)' }}>
              Image-only output — no searchable text, larger file. Verify before sharing. You
              are responsible for the final output.
            </div>
            {status === 'error' && error && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: 'var(--danger, #ef4444)' }}>{error.friendly}</div>
                <ErrorDetails raw={error.raw} />
              </div>
            )}
          </div>
        </>
      )}
      <ConfirmReplaceModal
        open={pendingHandoff !== null}
        onKeep={onKeepEdits}
        onReplace={onReplaceEdits}
      />
    </section>
  );
}
