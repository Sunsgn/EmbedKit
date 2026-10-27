import { describe, expect, it } from 'vitest';
import { COMMUNICATION_SHORTCUTS_KEY, loadCommunicationShortcutLimit, loadCommunicationShortcuts } from './communicationShortcuts';

describe('shared communication shortcuts', () => {
  it('normalizes serial-compatible shortcuts for network transports', () => {
    const storage = { getItem: (key: string) => key === COMMUNICATION_SHORTCUTS_KEY ? JSON.stringify([{ id: 7, name: '心跳', value: 'AA 55', hex: true, intervalMs: 10 }]) : '250' };
    expect(loadCommunicationShortcuts(storage)).toEqual([{ id: 7, name: '心跳', value: 'AA 55', hex: true, intervalMs: 100 }]);
    expect(loadCommunicationShortcutLimit(storage)).toBe(100);
  });

  it('degrades damaged shortcut storage to an empty list', () => {
    expect(loadCommunicationShortcuts({ getItem: () => '{bad' })).toEqual([]);
  });
});
