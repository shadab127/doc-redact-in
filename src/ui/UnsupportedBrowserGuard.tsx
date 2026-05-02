/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
'use client';

import { useEffect } from 'react';

export function isBrowserCapable(): boolean {
  if (typeof window === 'undefined') return true;
  if (typeof WebAssembly === 'undefined') return false;
  if (typeof document.createElement !== 'function') return false;
  const probe = document.createElement('canvas');
  if (typeof probe.getContext !== 'function') return false;
  if (typeof URL?.createObjectURL !== 'function') return false;
  if (typeof Blob === 'undefined') return false;
  return true;
}

export function UnsupportedBrowserGuard() {
  useEffect(() => {
    if (isBrowserCapable()) return;
    if (window.location.pathname.startsWith('/unsupported-browser')) return;
    window.location.replace('/unsupported-browser');
  }, []);
  return null;
}
