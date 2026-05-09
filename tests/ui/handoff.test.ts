/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  _resetForTests,
  consumeManualHandoff,
  peekManualHandoff,
  setManualHandoff,
  subscribeManualHandoff,
  type ManualHandoff,
} from '@/src/ui/manual/handoff';

afterEach(() => {
  _resetForTests();
});

function makeHandoff(name = 'doc.pdf'): ManualHandoff {
  const canvas = { width: 10, height: 10 } as unknown as HTMLCanvasElement;
  return {
    fileName: name,
    pages: [{ canvas, width: 10, height: 10, widthPt: 7.5, heightPt: 7.5 }],
    seedBoxes: new Map(),
  };
}

describe('handoff singleton', () => {
  it('peek returns null when nothing is set', () => {
    expect(peekManualHandoff()).toBeNull();
  });

  it('set then peek returns the handoff without clearing it', () => {
    const h = makeHandoff();
    setManualHandoff(h);
    expect(peekManualHandoff()).toBe(h);
    expect(peekManualHandoff()).toBe(h);
  });

  it('consume returns the handoff and clears it', () => {
    const h = makeHandoff();
    setManualHandoff(h);
    expect(consumeManualHandoff()).toBe(h);
    expect(peekManualHandoff()).toBeNull();
    expect(consumeManualHandoff()).toBeNull();
  });

  it('set overwrites a pending handoff', () => {
    const first = makeHandoff('first.pdf');
    const second = makeHandoff('second.pdf');
    setManualHandoff(first);
    setManualHandoff(second);
    expect(peekManualHandoff()).toBe(second);
  });

  it('subscribe fires on set and consume', () => {
    const listener = vi.fn();
    subscribeManualHandoff(listener);
    setManualHandoff(makeHandoff());
    expect(listener).toHaveBeenCalledTimes(1);
    consumeManualHandoff();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('subscribe does not fire on consume when already empty', () => {
    const listener = vi.fn();
    subscribeManualHandoff(listener);
    consumeManualHandoff();
    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribe stops further notifications', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeManualHandoff(listener);
    setManualHandoff(makeHandoff());
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setManualHandoff(makeHandoff('other.pdf'));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
