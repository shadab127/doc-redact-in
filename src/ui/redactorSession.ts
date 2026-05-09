/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */

import type { DocumentDetectionResult } from '@/src/detection/types';
import type { RasterizedPageLike } from '@/src/detection/DetectionOrchestrator';

export interface RedactorSession {
  result: DocumentDetectionResult;
  rasters: RasterizedPageLike[];
  fileName: string;
  pagePtSizes: Array<{ width: number; height: number }>;
  enabled: Map<string, boolean>;
  previewPageIndex: number;
}

// Module-level store so the auto-detect result view survives component
// unmount when the user clicks the handoff link (navigates to /manual) and
// then navigates back. Cleared only by an explicit "Start over" action.
let session: RedactorSession | null = null;

export function getRedactorSession(): RedactorSession | null {
  return session;
}

export function setRedactorSession(next: RedactorSession | null): void {
  session = next;
}

export function updateRedactorSession(patch: Partial<RedactorSession>): void {
  if (!session) return;
  session = { ...session, ...patch };
}

export function _resetForTests(): void {
  session = null;
}
