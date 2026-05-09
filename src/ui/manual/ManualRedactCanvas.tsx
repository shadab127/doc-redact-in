/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ALL_HANDLES,
  normalizeBox,
  type HandleDir,
  type UserBox,
} from './types';

export interface ManualRedactCanvasProps {
  raster: { canvas: HTMLCanvasElement; width: number; height: number };
  boxes: readonly UserBox[];
  selectedId: string | null;
  onBoxesChange: (next: UserBox[]) => void;
  onSelect: (id: string | null) => void;
  maxDisplayWidth?: number;
}

type Drag =
  | { kind: 'draw'; startX: number; startY: number; curX: number; curY: number; moved: boolean }
  | { kind: 'move'; id: string; offsetX: number; offsetY: number }
  | { kind: 'resize'; id: string; dir: HandleDir; startBox: UserBox }
  | null;

const HANDLE_SCREEN_PX = 12;
const HANDLE_HIT_PX = 28;
const DELETE_BTN_SIZE = 32;
const DELETE_BTN_OFFSET = 14;
const DRAW_START_THRESHOLD_SCREEN_PX = 4;
const MIN_BOX_NATIVE_PX = 4;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

interface ViewTransform {
  zoom: number;
  panX: number;
  panY: number;
}

const IDENTITY_VIEW: ViewTransform = { zoom: 1, panX: 0, panY: 0 };

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function cursorForHandle(dir: HandleDir): string {
  switch (dir) {
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
  }
}

function handleCenter(b: UserBox, dir: HandleDir): { x: number; y: number } {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const right = b.x + b.w;
  const bottom = b.y + b.h;
  switch (dir) {
    case 'nw':
      return { x: b.x, y: b.y };
    case 'n':
      return { x: cx, y: b.y };
    case 'ne':
      return { x: right, y: b.y };
    case 'e':
      return { x: right, y: cy };
    case 'se':
      return { x: right, y: bottom };
    case 's':
      return { x: cx, y: bottom };
    case 'sw':
      return { x: b.x, y: bottom };
    case 'w':
      return { x: b.x, y: cy };
  }
}

function pointInBox(b: UserBox, x: number, y: number): boolean {
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

function applyResize(start: UserBox, dir: HandleDir, ptrX: number, ptrY: number): UserBox {
  const x1 = dir.includes('w') ? ptrX : start.x;
  const x2 = dir.includes('e') ? ptrX : start.x + start.w;
  const y1 = dir.includes('n') ? ptrY : start.y;
  const y2 = dir.includes('s') ? ptrY : start.y + start.h;
  const n = normalizeBox(x1, y1, x2, y2);
  return { id: start.id, ...n };
}

// Clamp pan so the transformed content does not leave the viewport uncovered.
// At zoom=1 this forces pan back to (0,0); at zoom>1 the content may be slid
// freely within the extra width/height introduced by the zoom.
function clampPan(
  view: ViewTransform,
  viewportW: number,
  viewportH: number
): ViewTransform {
  const contentW = viewportW * view.zoom;
  const contentH = viewportH * view.zoom;
  const minX = Math.min(0, viewportW - contentW);
  const minY = Math.min(0, viewportH - contentH);
  const maxX = 0;
  const maxY = 0;
  return {
    zoom: view.zoom,
    panX: Math.max(minX, Math.min(maxX, view.panX)),
    panY: Math.max(minY, Math.min(maxY, view.panY)),
  };
}

export function ManualRedactCanvas({
  raster,
  boxes,
  selectedId,
  onBoxesChange,
  onSelect,
  maxDisplayWidth = 900,
}: ManualRedactCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const dragRef = useRef<Drag>(null);
  dragRef.current = drag;
  const boxesRef = useRef<readonly UserBox[]>(boxes);
  boxesRef.current = boxes;

  const [view, setView] = useState<ViewTransform>(IDENTITY_VIEW);
  const viewRef = useRef<ViewTransform>(view);
  viewRef.current = view;

  // Active pointers currently on the surface. We need to detect the moment a
  // second finger lands (cancel any one-finger drag and enter gesture mode)
  // and the moment the last finger lifts (exit gesture mode).
  const activePointersRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const gestureRef = useRef<{
    startDist: number;
    startZoom: number;
    startPan: { x: number; y: number };
    startMidX: number;
    startMidY: number;
  } | null>(null);
  // Flag: after a 2-pointer gesture, suppress click/draw handling until all
  // pointers have lifted. Without this, the leftover finger's pointer-up
  // fires at the end of a pinch and would commit a phantom tap.
  const suppressUntilAllUpRef = useRef(false);

  const baseScale = useMemo(() => {
    const w = raster.width || 1;
    return Math.min(1, maxDisplayWidth / w);
  }, [raster.width, maxDisplayWidth]);

  const displayWidth = Math.round(raster.width * baseScale);
  const displayHeight = Math.round(raster.height * baseScale);

  // Paint source raster onto the static display canvas at the unzoomed display
  // size. Zoom/pan are applied via CSS transform on the parent, so re-rendering
  // isn't needed when the view changes.
  useLayoutEffect(() => {
    const dest = sourceCanvasRef.current;
    if (!dest) return;
    dest.width = displayWidth;
    dest.height = displayHeight;
    const ctx = dest.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.drawImage(raster.canvas, 0, 0, displayWidth, displayHeight);
  }, [raster.canvas, displayWidth, displayHeight]);

  const screenToNative = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const el = wrapperRef.current;
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      const dispW = r.width || displayWidth;
      const dispH = r.height || displayHeight;
      const v = viewRef.current;
      // Map client → outer-local.
      const ox = clientX - r.left;
      const oy = clientY - r.top;
      // Remove pan and zoom.
      const lx = (ox - v.panX) / v.zoom;
      const ly = (oy - v.panY) / v.zoom;
      // Map unzoomed display → native (compensates for fit-to-width scaling).
      const nx = (lx / dispW) * raster.width;
      const ny = (ly / dispH) * raster.height;
      return { x: nx, y: ny };
    },
    [displayWidth, displayHeight, raster.width, raster.height]
  );

  const hitTestHandle = useCallback(
    (clientX: number, clientY: number): HandleDir | null => {
      if (!selectedId) return null;
      const el = wrapperRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const sel = boxes.find((b) => b.id === selectedId);
      if (!sel) return null;
      const v = viewRef.current;
      const effScale = ((r.width || displayWidth) / raster.width) * v.zoom;
      const ox = clientX - r.left - v.panX;
      const oy = clientY - r.top - v.panY;
      for (const dir of ALL_HANDLES) {
        const c = handleCenter(sel, dir);
        const cx = c.x * effScale;
        const cy = c.y * effScale;
        if (Math.abs(ox - cx) <= HANDLE_HIT_PX / 2 && Math.abs(oy - cy) <= HANDLE_HIT_PX / 2) {
          return dir;
        }
      }
      return null;
    },
    [selectedId, boxes, raster.width, displayWidth]
  );

  const enterGesture = useCallback(() => {
    const pts = Array.from(activePointersRef.current.values());
    if (pts.length < 2) return;
    const p0 = pts[0];
    const p1 = pts[1];
    if (!p0 || !p1) return;
    const el = wrapperRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = p0.clientX - p1.clientX;
    const dy = p0.clientY - p1.clientY;
    const dist = Math.hypot(dx, dy) || 1;
    const midX = (p0.clientX + p1.clientX) / 2 - r.left;
    const midY = (p0.clientY + p1.clientY) / 2 - r.top;
    const v = viewRef.current;
    gestureRef.current = {
      startDist: dist,
      startZoom: v.zoom,
      startPan: { x: v.panX, y: v.panY },
      startMidX: midX,
      startMidY: midY,
    };
  }, []);

  const cancelSingleDrag = useCallback(() => {
    const d = dragRef.current;
    if (!d) return;
    // If a drawing preview is in flight, throw it away. Move/resize mutations
    // have already been committed incrementally, so nothing to undo.
    setDrag(null);
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Ignore right-clicks / middle-clicks.
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      activePointersRef.current.set(e.pointerId, {
        clientX: e.clientX,
        clientY: e.clientY,
      });

      // Second pointer down: cancel any in-flight single-pointer drag and
      // enter gesture mode for pinch/pan.
      if (activePointersRef.current.size >= 2) {
        cancelSingleDrag();
        enterGesture();
        suppressUntilAllUpRef.current = true;
        e.preventDefault();
        return;
      }

      // Single pointer: normal draw/select/move/resize flow.
      if (suppressUntilAllUpRef.current) {
        // Defensive: shouldn't happen (suppression clears at all-up) but bail.
        return;
      }
      const target = e.target as HTMLElement;
      if (target.dataset?.role === 'delete-btn') return;

      const handle = hitTestHandle(e.clientX, e.clientY);
      if (handle && selectedId) {
        const sel = boxes.find((b) => b.id === selectedId);
        if (sel) {
          setDrag({ kind: 'resize', id: sel.id, dir: handle, startBox: { ...sel } });
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          e.preventDefault();
          return;
        }
      }

      const { x, y } = screenToNative(e.clientX, e.clientY);
      let hit: UserBox | null = null;
      for (let i = boxes.length - 1; i >= 0; i--) {
        const b = boxes[i];
        if (b && pointInBox(b, x, y)) {
          hit = b;
          break;
        }
      }
      if (hit) {
        onSelect(hit.id);
        setDrag({ kind: 'move', id: hit.id, offsetX: x - hit.x, offsetY: y - hit.y });
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }

      onSelect(null);
      setDrag({ kind: 'draw', startX: x, startY: y, curX: x, curY: y, moved: false });
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [boxes, cancelSingleDrag, enterGesture, hitTestHandle, onSelect, screenToNative, selectedId]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (activePointersRef.current.has(e.pointerId)) {
        activePointersRef.current.set(e.pointerId, {
          clientX: e.clientX,
          clientY: e.clientY,
        });
      }

      // Two-pointer pinch/pan takes priority over any single-pointer drag.
      if (activePointersRef.current.size >= 2 && gestureRef.current) {
        const pts = Array.from(activePointersRef.current.values());
        const p0 = pts[0];
        const p1 = pts[1];
        if (!p0 || !p1) return;
        const el = wrapperRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = p0.clientX - p1.clientX;
        const dy = p0.clientY - p1.clientY;
        const dist = Math.hypot(dx, dy) || 1;
        const midX = (p0.clientX + p1.clientX) / 2 - r.left;
        const midY = (p0.clientY + p1.clientY) / 2 - r.top;

        const g = gestureRef.current;
        const rawZoom = g.startZoom * (dist / g.startDist);
        const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, rawZoom));

        // Keep the point that was under the pinch midpoint fixed in world
        // space: newPan = mid - (startMid - startPan) * (zoom / startZoom) +
        // (mid - startMid). Equivalently, derive target pan so that the pre-
        // zoom world coord under startMid still renders under midX/midY.
        const worldX = (g.startMidX - g.startPan.x) / g.startZoom;
        const worldY = (g.startMidY - g.startPan.y) / g.startZoom;
        let panX = midX - worldX * zoom;
        let panY = midY - worldY * zoom;

        const clamped = clampPan(
          { zoom, panX, panY },
          r.width || displayWidth,
          r.height || displayHeight
        );
        setView(clamped);
        e.preventDefault();
        return;
      }

      const d = dragRef.current;
      if (!d) return;
      const { x, y } = screenToNative(e.clientX, e.clientY);
      if (d.kind === 'draw') {
        const el = wrapperRef.current;
        const v = viewRef.current;
        const effScale = el
          ? ((el.getBoundingClientRect().width || displayWidth) / raster.width) * v.zoom
          : v.zoom;
        const dxScreen = Math.abs(x - d.startX) * effScale;
        const dyScreen = Math.abs(y - d.startY) * effScale;
        const moved =
          d.moved || dxScreen >= DRAW_START_THRESHOLD_SCREEN_PX || dyScreen >= DRAW_START_THRESHOLD_SCREEN_PX;
        setDrag({ ...d, curX: x, curY: y, moved });
      } else if (d.kind === 'move') {
        const current = boxesRef.current.find((b) => b.id === d.id);
        if (!current) return;
        const newX = Math.max(0, Math.min(raster.width - current.w, x - d.offsetX));
        const newY = Math.max(0, Math.min(raster.height - current.h, y - d.offsetY));
        const next = boxesRef.current.map((b) =>
          b.id === d.id ? { ...b, x: newX, y: newY } : b
        );
        onBoxesChange(next);
      } else if (d.kind === 'resize') {
        const resized = applyResize(d.startBox, d.dir, x, y);
        const clampedX = Math.max(0, Math.min(raster.width, resized.x));
        const clampedY = Math.max(0, Math.min(raster.height, resized.y));
        const clampedW = Math.max(0, Math.min(raster.width - clampedX, resized.w));
        const clampedH = Math.max(0, Math.min(raster.height - clampedY, resized.h));
        const next = boxesRef.current.map((b) =>
          b.id === d.id ? { id: b.id, x: clampedX, y: clampedY, w: clampedW, h: clampedH } : b
        );
        onBoxesChange(next);
      }
    },
    [displayHeight, displayWidth, onBoxesChange, raster.height, raster.width, screenToNative]
  );

  const endPointer = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      activePointersRef.current.delete(e.pointerId);
      try {
        (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      if (activePointersRef.current.size === 0) {
        gestureRef.current = null;
        // Commit any pending draw (only possible if we didn't enter gesture
        // mode). If suppression is set, discard instead.
        const d = dragRef.current;
        if (d && !suppressUntilAllUpRef.current) {
          if (d.kind === 'draw' && d.moved) {
            const n = normalizeBox(d.startX, d.startY, d.curX, d.curY);
            if (n.w >= MIN_BOX_NATIVE_PX && n.h >= MIN_BOX_NATIVE_PX) {
              const id = uid();
              const clamped = {
                id,
                x: Math.max(0, Math.min(raster.width, n.x)),
                y: Math.max(0, Math.min(raster.height, n.y)),
                w: Math.max(0, Math.min(raster.width, n.w)),
                h: Math.max(0, Math.min(raster.height, n.h)),
              };
              onBoxesChange([...boxesRef.current, clamped]);
              onSelect(id);
            }
          }
        }
        setDrag(null);
        suppressUntilAllUpRef.current = false;
      } else if (activePointersRef.current.size === 1) {
        // Dropped from 2 pointers back to 1 — keep suppressing to avoid the
        // remaining pointer becoming a stray draw. It will be released when
        // that last pointer lifts too.
        gestureRef.current = null;
      }
    },
    [onBoxesChange, onSelect, raster.height, raster.width]
  );

  // Escape deselects.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSelect(null);
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        onBoxesChange(boxesRef.current.filter((b) => b.id !== selectedId));
        onSelect(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBoxesChange, onSelect, selectedId]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    onBoxesChange(boxesRef.current.filter((b) => b.id !== selectedId));
    onSelect(null);
  }, [onBoxesChange, onSelect, selectedId]);

  const resetView = useCallback(() => {
    setView(IDENTITY_VIEW);
  }, []);

  const drawPreview = useMemo(() => {
    if (!drag || drag.kind !== 'draw' || !drag.moved) return null;
    return normalizeBox(drag.startX, drag.startY, drag.curX, drag.curY);
  }, [drag]);

  const selectedBox = useMemo(
    () => boxes.find((b) => b.id === selectedId) ?? null,
    [boxes, selectedId]
  );

  const screenScale = baseScale * view.zoom;

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={wrapperRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        data-testid="manual-redact-canvas"
        style={{
          position: 'relative',
          width: displayWidth,
          height: displayHeight,
          maxWidth: '100%',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#111318',
          userSelect: 'none',
          touchAction: 'none',
          cursor: drag?.kind === 'resize' ? cursorForHandle(drag.dir) : 'crosshair',
        }}
      >
        {/* Inner transformed layer: source + box SVG. Zoom/pan is applied in
            screen space via CSS transform — the underlying pixel buffers are
            unchanged so we only pay a paint cost. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transformOrigin: '0 0',
            transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
            willChange: 'transform',
          }}
        >
          <canvas
            ref={sourceCanvasRef}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          />
          <svg
            viewBox={`0 0 ${raster.width} ${raster.height}`}
            preserveAspectRatio="none"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            {boxes.map((b) => {
              const isSel = b.id === selectedId;
              return (
                <rect
                  key={b.id}
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  fill="rgba(0,0,0,0.75)"
                  stroke={isSel ? '#a78bfa' : 'rgba(255,255,255,0.5)'}
                  strokeWidth={isSel ? 2 : 1}
                  vectorEffect="non-scaling-stroke"
                  data-testid={`manual-box-${b.id}`}
                />
              );
            })}
            {drawPreview && (
              <rect
                x={drawPreview.x}
                y={drawPreview.y}
                width={drawPreview.w}
                height={drawPreview.h}
                fill="rgba(167,139,250,0.25)"
                stroke="#a78bfa"
                strokeWidth={2}
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
                data-testid="manual-draw-preview"
              />
            )}
          </svg>
        </div>

        {/* Selection adornments live OUTSIDE the transformed layer so their
            screen size stays constant regardless of zoom level. */}
        {selectedBox && (
          <SelectionAdornments
            box={selectedBox}
            screenScale={screenScale}
            panX={view.panX}
            panY={view.panY}
            onDelete={deleteSelected}
          />
        )}
      </div>

      {view.zoom > 1.001 && (
        <button
          type="button"
          onClick={resetView}
          data-testid="manual-reset-view-btn"
          style={{
            position: 'absolute',
            right: 8,
            top: 8,
            background: 'rgba(17, 19, 24, 0.85)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 10px',
            cursor: 'pointer',
          }}
          aria-label="Reset zoom"
        >
          Reset zoom ({view.zoom.toFixed(1)}×)
        </button>
      )}
    </div>
  );
}

interface SelectionAdornmentsProps {
  box: UserBox;
  screenScale: number;
  panX: number;
  panY: number;
  onDelete: () => void;
}

function SelectionAdornments({
  box,
  screenScale,
  panX,
  panY,
  onDelete,
}: SelectionAdornmentsProps) {
  // Offset the delete button up-right of the NE handle so the two hit targets
  // don't overlap and users can reliably tap either one on mobile.
  const screenRight = (box.x + box.w) * screenScale + panX + DELETE_BTN_OFFSET;
  const screenTop = box.y * screenScale + panY - DELETE_BTN_OFFSET;
  return (
    <>
      {ALL_HANDLES.map((dir) => {
        const c = handleCenter(box, dir);
        const left = c.x * screenScale + panX - HANDLE_SCREEN_PX / 2;
        const top = c.y * screenScale + panY - HANDLE_SCREEN_PX / 2;
        return (
          <div
            key={dir}
            data-role="handle"
            data-dir={dir}
            style={{
              position: 'absolute',
              left,
              top,
              width: HANDLE_SCREEN_PX,
              height: HANDLE_SCREEN_PX,
              background: '#fff',
              border: '1.5px solid #a78bfa',
              borderRadius: 2,
              cursor: cursorForHandle(dir),
              pointerEvents: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
            }}
          />
        );
      })}
      <button
        type="button"
        data-role="delete-btn"
        data-testid="manual-delete-btn"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Delete selected box"
        style={{
          position: 'absolute',
          left: screenRight - DELETE_BTN_SIZE / 2,
          top: screenTop - DELETE_BTN_SIZE / 2,
          width: DELETE_BTN_SIZE,
          height: DELETE_BTN_SIZE,
          borderRadius: '50%',
          border: '1.5px solid #fff',
          background: '#ef4444',
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          lineHeight: 1,
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        ×
      </button>
    </>
  );
}
