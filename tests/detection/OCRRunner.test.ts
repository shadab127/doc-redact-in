// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOCRRunner } from '@/src/detection/OCRRunner';

const mocks = vi.hoisted(() => ({ createWorker: vi.fn(), recognize: vi.fn(), terminate: vi.fn() }));
vi.mock('tesseract.js', () => ({ createWorker: mocks.createWorker }));
beforeEach(() => {
  mocks.recognize.mockReset().mockResolvedValue({ data: { lines: [] } });
  mocks.terminate.mockReset().mockResolvedValue(undefined);
  mocks.createWorker.mockReset().mockResolvedValue({ recognize: mocks.recognize, terminate: mocks.terminate });
});

describe('OCR initialization recovery', () => {
  it('retries after a failed worker initialization', async () => {
    mocks.createWorker.mockRejectedValueOnce(new Error('asset unavailable'));
    const runner = createOCRRunner();
    await expect(runner.recognize(new Blob())).rejects.toThrow('asset unavailable');
    await expect(runner.recognize(new Blob())).resolves.toEqual([]);
    await runner.terminate();
    expect(mocks.createWorker).toHaveBeenCalledTimes(2);
    expect(mocks.terminate).toHaveBeenCalledOnce();
  });

  it('cleanup does not replace an initialization error', async () => {
    mocks.createWorker.mockRejectedValueOnce(new Error('asset unavailable'));
    const runner = createOCRRunner();
    await expect(runner.recognize(new Blob())).rejects.toThrow('asset unavailable');
    await expect(runner.terminate()).resolves.toBeUndefined();
  });

  it('reuses the worker within a document and starts fresh after termination', async () => {
    const runner = createOCRRunner();
    await runner.recognize(new Blob());
    await runner.recognize(new Blob());
    expect(mocks.createWorker).toHaveBeenCalledOnce();
    await runner.terminate();
    await runner.recognize(new Blob());
    expect(mocks.createWorker).toHaveBeenCalledTimes(2);
    await runner.terminate();
  });
});
