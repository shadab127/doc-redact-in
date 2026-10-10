// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { afterEach, expect, it } from 'vitest';
import { clearDocumentSessions, documentSessionGeneration, documentSessionSignal } from '@/src/ui/documentSession';
import { getRedactorSession, setRedactorSession } from '@/src/ui/redactorSession';
import { getManualSession, setManualSession } from '@/src/ui/manual/manualSession';
import { peekManualHandoff, setManualHandoff } from '@/src/ui/manual/handoff';

afterEach(clearDocumentSessions);

it('clears both sessions and pending handoffs and releases shared and distinct canvases', () => {
  const first = { width: 100, height: 80 } as HTMLCanvasElement;
  const second = { width: 200, height: 160 } as HTMLCanvasElement;
  const page = (canvas: HTMLCanvasElement) => ({ canvas, width: canvas.width, height: canvas.height, widthPt: 100, heightPt: 80 });
  setRedactorSession({
    result: { pages: [], totalElapsedMs: 0, sourceKind: 'image' },
    rasters: [{ canvas: first, width: 100, height: 80, pageIndex: 0 }],
    fileName: 'synthetic.png', pagePtSizes: [], enabled: new Map(), previewPageIndex: 0,
  });
  setManualSession({ fileName: 'synthetic.png', pages: [page(first)], boxesByPage: new Map(), pageIndex: 0, dirty: false });
  setManualHandoff({ fileName: 'synthetic.png', pages: [page(second)], seedBoxes: new Map() });
  const generation = documentSessionGeneration();
  const signal = documentSessionSignal();
  expect(signal.aborted).toBe(false);
  clearDocumentSessions();
  expect(signal.aborted).toBe(true);
  expect(documentSessionSignal().aborted).toBe(false);
  expect(documentSessionSignal()).not.toBe(signal);
  expect(getRedactorSession()).toBeNull();
  expect(getManualSession()).toBeNull();
  expect(peekManualHandoff()).toBeNull();
  expect([first.width, first.height, second.width, second.height]).toEqual([0, 0, 0, 0]);
  expect(documentSessionGeneration()).toBe(generation + 1);
  expect(() => clearDocumentSessions()).not.toThrow();
});
