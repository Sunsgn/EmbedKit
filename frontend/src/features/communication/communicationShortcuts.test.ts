import { describe, expect, it } from 'vitest';
import { COMMUNICATION_SHORTCUTS_KEY, loadCommunicationShortcutLimit, loadCommunicationShortcuts, saveCommunicationShortcutLimit, saveCommunicationShortcuts } from './communicationShortcuts';

describe('shared communication shortcuts', () => {
  it('normalizes serial-compatible shortcuts for network transports', () => {
    const storage = { getItem: (key: string) => key === COMMUNICATION_SHORTCUTS_KEY ? JSON.stringify([{ id: 7, name: '心跳', value: 'AA 55', hex: true, intervalMs: 10 }]) : '250' };
    expect(loadCommunicationShortcuts(storage)).toEqual([{ id: 7, name: '心跳', value: 'AA 55', hex: true, intervalMs: 100 }]);
    expect(loadCommunicationShortcutLimit(storage)).toBe(100);
  });

  it('degrades damaged shortcut storage to an empty list', () => {
    expect(loadCommunicationShortcuts({ getItem: () => '{bad' })).toEqual([]);
  });

  it('bounds persisted shortcut count, text, intervals and display limit', () => {
    const values = new Map<string, string>(), storage = { setItem: (key: string, value: string) => values.set(key, value) };
    saveCommunicationShortcuts(Array.from({ length: 101 }, (_, id) => ({ id, name: 'n', value: 'v', hex: false, intervalMs: 1 })), storage);
    saveCommunicationShortcutLimit(900, storage);
    expect(JSON.parse(values.get(COMMUNICATION_SHORTCUTS_KEY)!)).toHaveLength(100);
    expect(JSON.parse(values.get(COMMUNICATION_SHORTCUTS_KEY)!)[0].intervalMs).toBe(100);
    expect(loadCommunicationShortcutLimit({ getItem: key => values.get(key) ?? null })).toBe(100);
  });
});
