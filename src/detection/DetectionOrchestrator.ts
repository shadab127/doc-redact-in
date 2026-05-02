/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { detectAadhaar } from './AadhaarDetector';
import { detectPan } from './PanDetector';
import { createOCRRunner, type OCRInput, type OCRRunner } from './OCRRunner';
import type { DetectionResult } from './types';

export interface RunDetectionOptions {
  ocr?: OCRRunner;
}

function isPdfBlob(input: unknown): boolean {
  if (typeof Blob === 'undefined' || !(input instanceof Blob)) return false;
  if (input.type === 'application/pdf') return true;
  if (typeof File !== 'undefined' && input instanceof File) {
    return /\.pdf$/i.test(input.name);
  }
  return false;
}

async function measureSource(
  input: OCRInput
): Promise<{ width: number; height: number }> {
  if (typeof ImageBitmap !== 'undefined' && input instanceof ImageBitmap) {
    return { width: input.width, height: input.height };
  }
  if (
    typeof HTMLCanvasElement !== 'undefined' &&
    input instanceof HTMLCanvasElement
  ) {
    return { width: input.width, height: input.height };
  }
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    try {
      const bitmap = await createImageBitmap(input);
      const out = { width: bitmap.width, height: bitmap.height };
      bitmap.close?.();
      return out;
    } catch {
      return { width: 0, height: 0 };
    }
  }
  return { width: 0, height: 0 };
}

export async function runDetection(
  image: OCRInput,
  opts: RunDetectionOptions = {}
): Promise<DetectionResult> {
  if (isPdfBlob(image)) {
    throw new Error(
      'PDF input not supported yet — coming in W2 (pdf.js rasterization). Upload an image for now.'
    );
  }
  const started = Date.now();
  const ocr = opts.ocr ?? createOCRRunner();
  const [tokens, source] = await Promise.all([
    ocr.recognize(image),
    measureSource(image),
  ]);
  const detections = [...detectAadhaar(tokens), ...detectPan(tokens)];
  return {
    detections,
    sourceWidth: source.width,
    sourceHeight: source.height,
    elapsedMs: Date.now() - started,
  };
}
