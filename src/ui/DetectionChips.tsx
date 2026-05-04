/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */

export const DETECTION_CHIP_LABELS = ['Aadhaar', 'PAN', 'Passport MRZ', 'UIDAI QR', 'Faces'] as const;

const CHIPS = DETECTION_CHIP_LABELS;

export function DetectionChips() {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        marginTop: '40px',
        marginBottom: '16px',
        justifyContent: 'center',
      }}
    >
      {CHIPS.map((label) => (
        <span key={label} className="chip">
          {label}
        </span>
      ))}
    </div>
  );
}
