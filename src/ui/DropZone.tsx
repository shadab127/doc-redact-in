/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
'use client';

import { useCallback, useState, type DragEvent, type ChangeEvent } from 'react';

export interface DropZoneProps {
  onFile: (file: File) => void;
  accept?: string;
  disabled?: boolean;
}

export function DropZone({
  onFile,
  accept = 'image/*,application/pdf',
  disabled = false,
}: DropZoneProps) {
  const [isDragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (disabled || !files || files.length === 0) return;
      const first = files[0];
      if (first) onFile(first);
    },
    [disabled, onFile]
  );

  const onDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };

  return (
    <label
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        display: 'block',
        border: `2px dashed ${isDragging ? 'var(--brand)' : 'var(--border-strong)'}`,
        background: isDragging ? 'var(--brand-surface)' : 'var(--surface-subtle)',
        borderRadius: 14,
        padding: '52px 16px',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'border-color 160ms, background 160ms',
      }}
    >
      <input
        type="file"
        accept={accept}
        onChange={onChange}
        disabled={disabled}
        style={{ display: 'none' }}
        data-testid="dropzone-input"
      />
      <div style={{ fontSize: 16, fontWeight: 600 }}>
        {isDragging ? 'Drop file to redact' : 'Drop or tap to choose a file'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
        Images or PDFs. Everything runs locally.
      </div>
    </label>
  );
}
