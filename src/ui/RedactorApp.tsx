/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
'use client';

import { useState } from 'react';
import { DropZone } from './DropZone';
import { runDetection } from '@/src/detection/DetectionOrchestrator';
import type { DetectionResult } from '@/src/detection/types';

type Status = 'idle' | 'running' | 'done' | 'error';

export function RedactorApp() {
  const [status, setStatus] = useState<Status>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setFileName(file.name);
    setStatus('running');
    setError(null);
    setResult(null);
    try {
      const res = await runDetection(file);
      setResult(res);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  };

  return (
    <section style={{ marginTop: 24 }}>
      <DropZone onFile={onFile} disabled={status === 'running'} />
      <div style={{ marginTop: 16, fontSize: 14, color: 'var(--muted)' }}>
        {status === 'idle' && 'Choose a file to begin.'}
        {status === 'running' && `Scanning ${fileName}…`}
        {status === 'error' && `Error: ${error}`}
        {status === 'done' && result && (
          <>
            Found <strong>{result.detections.length}</strong> detection
            {result.detections.length === 1 ? '' : 's'} in {result.elapsedMs} ms.
            <pre
              style={{
                marginTop: 12,
                padding: 12,
                background: '#111318',
                borderRadius: 8,
                fontSize: 12,
                overflow: 'auto',
              }}
            >
              {JSON.stringify(
                result.detections.map((d) => ({
                  kind: d.kind,
                  confidence: d.confidence,
                  bbox: d.bbox,
                })),
                null,
                2
              )}
            </pre>
          </>
        )}
      </div>
    </section>
  );
}
