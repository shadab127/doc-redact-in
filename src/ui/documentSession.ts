// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { getRedactorSession, setRedactorSession } from './redactorSession';
import { getManualSession, setManualSession } from './manual/manualSession';
import { clearManualHandoff, peekManualHandoff } from './manual/handoff';

let generation = 0;
let controller = new AbortController();

export function documentSessionGeneration(): number {
  return generation;
}

export function documentSessionSignal(): AbortSignal {
  return controller.signal;
}

export function clearDocumentSessions(): void {
  generation++;
  controller.abort();
  controller = new AbortController();
  const canvases = new Set([
    ...(getRedactorSession()?.rasters.map((p) => p.canvas) ?? []),
    ...(getManualSession()?.pages.map((p) => p.canvas) ?? []),
    ...(peekManualHandoff()?.pages.map((p) => p.canvas) ?? []),
  ]);
  setRedactorSession(null);
  setManualSession(null);
  clearManualHandoff();
  for (const canvas of canvases) {
    canvas.width = 0;
    canvas.height = 0;
  }
}
