// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runDetection, runDetectionOnDocument } from '@/src/detection/DetectionOrchestrator';

const owned = vi.hoisted(() => ({ recognize: vi.fn(), terminate: vi.fn() }));
vi.mock('@/src/detection/OCRRunner', () => ({ createOCRRunner: () => owned }));
beforeEach(() => {
  owned.recognize.mockReset().mockResolvedValue([]);
  owned.terminate.mockReset().mockResolvedValue(undefined);
});

describe('owned OCR lifecycle', () => {
  it.each([runDetection, runDetectionOnDocument])('terminates after a successful image run', async (run) => {
    await run(new Blob());
    expect(owned.terminate).toHaveBeenCalledOnce();
  });

  it.each([runDetection, runDetectionOnDocument])('terminates after OCR failure', async (run) => {
    owned.recognize.mockRejectedValue(new Error('OCR failed'));
    await expect(run(new Blob())).rejects.toThrow('OCR failed');
    expect(owned.terminate).toHaveBeenCalledOnce();
  });

  it('does not terminate a caller-owned OCR runner', async () => {
    await runDetectionOnDocument(new Blob(), { ocr: owned });
    expect(owned.terminate).not.toHaveBeenCalled();
  });

  it('cleans up the PDF pipeline when loading fails', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    await expect(runDetectionOnDocument(new Blob(['pdf'], { type: 'application/pdf' }), {
      pdfPipeline: () => ({
        load: async () => { throw new Error('PDF failed'); },
        rasterize: vi.fn(), destroy,
      }),
    })).rejects.toThrow('PDF failed');
    expect(destroy).toHaveBeenCalledOnce();
    expect(owned.terminate).toHaveBeenCalledOnce();
  });

  it('rejects excessive pages before rasterization and cleans up', async () => {
    const rasterize = vi.fn();
    const destroy = vi.fn().mockResolvedValue(undefined);
    await expect(runDetectionOnDocument(new Blob(['pdf'], { type: 'application/pdf' }), {
      pdfPipeline: () => ({ load: async () => ({ numPages: 11, pageSizesPt: [] }), rasterize, destroy }),
    })).rejects.toThrow('10 pages');
    expect(rasterize).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledOnce();
  });
});
