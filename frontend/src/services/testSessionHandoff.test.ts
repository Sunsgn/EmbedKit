import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSerialTestSessionHandoff, readSerialTestSessionHandoff, writeSerialTestSessionHandoff } from './testSessionHandoff';

const session = { id: 'session-1', path: 'COM7', baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', dtr: false, rts: false, state: 'connected' as const, rxBytes: 0, txBytes: 0, openedAt: '', events: [] };

describe('serial test session handoff', () => {
  beforeEach(() => { sessionStorage.clear(); vi.stubGlobal('crypto', { randomUUID: () => 'handoff-1' }); });

  it('stores a bounded versioned handoff and reads it before expiry', () => {
    const saved = writeSerialTestSessionHandoff(session, 1_000);
    expect(saved).toMatchObject({ version: 1, id: 'handoff-1', sessionId: 'session-1', path: 'COM7', baudRate: 115200 });
    expect(readSerialTestSessionHandoff(2_000)).toEqual(saved);
  });

  it('removes expired or damaged handoffs', () => {
    writeSerialTestSessionHandoff(session, 1_000);
    expect(readSerialTestSessionHandoff(1_000 + 10 * 60 * 1000)).toBeNull();
    sessionStorage.setItem('embedkit.test-session-handoff.pending', '{bad');
    expect(readSerialTestSessionHandoff()).toBeNull();
  });

  it('only clears the matching handoff when an id is supplied', () => {
    writeSerialTestSessionHandoff(session, Date.now());
    clearSerialTestSessionHandoff('another');
    expect(readSerialTestSessionHandoff()).not.toBeNull();
    clearSerialTestSessionHandoff('handoff-1');
    expect(readSerialTestSessionHandoff()).toBeNull();
  });
});
