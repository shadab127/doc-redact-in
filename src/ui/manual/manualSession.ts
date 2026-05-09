/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */

import type { UserBox } from './types';

export interface ManualSessionPage {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  widthPt: number;
  heightPt: number;
}

export interface ManualSession {
  fileName: string;
  pages: ManualSessionPage[];
  boxesByPage: Map<number, UserBox[]>;
  pageIndex: number;
  dirty: boolean;
}

// Module-level store so /manual state survives component unmount when the
// user navigates back to / and returns. Cleared only by an explicit reset
// action (DropZone is only shown when this is null).
let session: ManualSession | null = null;

export function getManualSession(): ManualSession | null {
  return session;
}

export function setManualSession(next: ManualSession | null): void {
  session = next;
}

export function updateManualSession(patch: Partial<ManualSession>): void {
  if (!session) return;
  session = { ...session, ...patch };
}

export function _resetForTests(): void {
  session = null;
}
