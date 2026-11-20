import { describe, expect, it, vi } from 'vitest';
import { ConnectionSessionManager } from './connectionSessionManager';

const session = (id: string, transport: 'serial' | 'tcp' = 'serial') => ({ id, transport, provider: 'local-agent' as const, state: 'connected' as const, endpoint: transport === 'serial' ? 'COM3' : '127.0.0.1:9000', rxBytes: 1, txBytes: 2, updatedAt: `2026-11-20T00:00:0${id}.000Z` });

describe('connection session manager', () => {
  it('keeps hardware session state outside page component lifetime', () => {
    const manager = new ConnectionSessionManager(), listener = vi.fn();
    const unsubscribe = manager.subscribe(listener);
    manager.upsert(session('1'));
    unsubscribe();
    expect(manager.get('serial', '1')).toMatchObject({ endpoint: 'COM3', state: 'connected' });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('reconciles only the requested Local Agent transport scope', () => {
    const manager = new ConnectionSessionManager();
    manager.upsert(session('1'));
    manager.upsert(session('2', 'tcp'));
    manager.reconcile(['serial'], []);
    expect(manager.get('serial', '1')).toBeNull();
    expect(manager.get('tcp', '2')).not.toBeNull();
  });
});
