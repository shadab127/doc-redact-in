/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { describe, expect, it } from 'vitest';
import { DETECTION_CHIP_LABELS } from '@/src/ui/DetectionChips';

describe('DetectionChips labels', () => {
  it('exports exactly 5 chip labels', () => {
    expect(DETECTION_CHIP_LABELS).toHaveLength(5);
  });

  it('includes Aadhaar', () => {
    expect(DETECTION_CHIP_LABELS).toContain('Aadhaar');
  });

  it('includes PAN', () => {
    expect(DETECTION_CHIP_LABELS).toContain('PAN');
  });

  it('includes Passport MRZ', () => {
    expect(DETECTION_CHIP_LABELS).toContain('Passport MRZ');
  });

  it('includes UIDAI QR', () => {
    expect(DETECTION_CHIP_LABELS).toContain('UIDAI QR');
  });

  it('includes Faces', () => {
    expect(DETECTION_CHIP_LABELS).toContain('Faces');
  });
});
