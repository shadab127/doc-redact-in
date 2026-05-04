/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
'use client';

import { useRef, type ChangeEvent } from 'react';

export interface CameraCaptureProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function CameraCapture({ onFile, disabled = false }: CameraCaptureProps) {
  const ref = useRef<HTMLInputElement | null>(null);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = '';
  };

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        style={{
          width: '100%',
          padding: '18px 16px',
          background: 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: '0.01em',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          boxShadow: '0 10px 24px -12px rgba(124, 58, 237, 0.7), inset 0 1px 0 rgba(255,255,255,0.15)',
        }}
        data-testid="camera-capture-button"
      >
        📷 Take Photo
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onChange}
        disabled={disabled}
        style={{ display: 'none' }}
        data-testid="camera-capture-input"
      />
    </div>
  );
}
