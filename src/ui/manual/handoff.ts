/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */

import type { UserBox } from './types';

export interface ManualHandoffPage {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  widthPt: number;
  heightPt: number;
}

export interface ManualHandoff {
  fileName: string;
  pages: ManualHandoffPage[];
  seedBoxes: Map<number, UserBox[]>;
}

type Listener = () => void;

// Module-level singleton. The whole point of the handoff is to pass canvas
// references across a client-side route transition without serializing —
// sessionStorage/localStorage would violate the "nothing leaves working memory
// as bytes" invariant we already uphold everywhere else. Canvases stay live
// because Next.js client-side nav does not tear down the JS heap.
let pending: ManualHandoff | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of listeners) l();
}

export function setManualHandoff(handoff: ManualHandoff): void {
  pending = handoff;
  notify();
}

export function peekManualHandoff(): ManualHandoff | null {
  return pending;
}

export function consumeManualHandoff(): ManualHandoff | null {
  const out = pending;
  pending = null;
  if (out) notify();
  return out;
}

export function clearManualHandoff(): void {
  if (pending === null) return;
  pending = null;
  notify();
}

export function subscribeManualHandoff(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Exposed for tests only — resets singleton + listeners between test cases so
// the module-level state doesn't bleed.
export function _resetForTests(): void {
  pending = null;
  listeners.clear();
}
