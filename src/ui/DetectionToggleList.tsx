/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
'use client';

import type { Detection, DetectionKind } from '@/src/detection/types';

const KIND_LABELS: Record<DetectionKind, string> = {
  aadhaar: 'Aadhaar number (mask first 8 digits)',
  pan: 'PAN card number',
  passport_mrz: 'Passport MRZ (machine-readable zone)',
  face: 'Face photograph',
  uidai_qr: 'UIDAI QR code',
  other_qr: 'Other QR code (review before masking)',
};

const KIND_DEFAULT_ON: Record<DetectionKind, boolean> = {
  aadhaar: true,
  pan: true,
  passport_mrz: true,
  face: true,
  uidai_qr: true,
  other_qr: false,
};

export interface ToggleKey {
  pageIndex: number;
  detectionIndex: number;
}

export interface DetectionToggleListProps {
  pages: readonly { pageIndex: number; detections: readonly Detection[] }[];
  enabled: ReadonlyMap<string, boolean>;
  onToggle: (key: ToggleKey, next: boolean) => void;
}

export function toggleKeyString(k: ToggleKey): string {
  return `${k.pageIndex}:${k.detectionIndex}`;
}

export function defaultEnabledMap(
  pages: readonly { pageIndex: number; detections: readonly Detection[] }[]
): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (const p of pages) {
    p.detections.forEach((d, i) => {
      m.set(
        toggleKeyString({ pageIndex: p.pageIndex, detectionIndex: i }),
        KIND_DEFAULT_ON[d.kind]
      );
    });
  }
  return m;
}

export function filterEnabledDetections(
  pages: readonly { pageIndex: number; detections: readonly Detection[] }[],
  enabled: ReadonlyMap<string, boolean>
): Detection[][] {
  return pages.map((p) =>
    p.detections.filter((_, i) =>
      enabled.get(toggleKeyString({ pageIndex: p.pageIndex, detectionIndex: i })) ?? false
    )
  );
}

function formatBbox(bbox: Detection['bbox']): string {
  return `${Math.round(bbox.x)}×${Math.round(bbox.y)} ${Math.round(bbox.w)}w${Math.round(bbox.h)}h`;
}

export function DetectionToggleList({
  pages,
  enabled,
  onToggle,
}: DetectionToggleListProps) {
  const total = pages.reduce((n, p) => n + p.detections.length, 0);
  if (total === 0) {
    return (
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>
        No Aadhaar, PAN, passport, QR, or face detections on this document.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
        Review each detection. Uncheck anything that isn&apos;t actually PII. The
        download is what you see here.
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {pages.flatMap((p) =>
          p.detections.map((d, i) => {
            const key: ToggleKey = { pageIndex: p.pageIndex, detectionIndex: i };
            const keyStr = toggleKeyString(key);
            const isOn = enabled.get(keyStr) ?? false;
            return (
              <li
                key={keyStr}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={(e) => onToggle(key, e.target.checked)}
                  data-testid={`toggle-${keyStr}`}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <div style={{ flex: 1, fontSize: 14 }}>
                  <div>{KIND_LABELS[d.kind]}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    page {p.pageIndex + 1} · {formatBbox(d.bbox)} · confidence{' '}
                    {Math.round(d.confidence * 100)}%
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
