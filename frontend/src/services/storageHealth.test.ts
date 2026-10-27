import { beforeEach, describe, expect, it } from 'vitest';
import { clearStillBrokenSettings, inspectStorageHealth } from './storageHealth';

describe('local settings health diagnostics', () => {
  beforeEach(() => localStorage.clear());

  it('reports only metadata for malformed or structurally invalid settings', () => {
    localStorage.setItem('embedkit.serial.shortcuts', 'secret malformed value');
    localStorage.setItem('embedkit.network.send-history', '{}');

    const report = inspectStorageHealth(localStorage, new Date('2026-10-12T08:00:00.000Z'));

    expect(report).toMatchObject({ schema: 'embedkit.storage-health', version: 1, checked: 9, generatedAt: '2026-10-12T08:00:00.000Z' });
    expect(report.issues).toEqual([
      expect.objectContaining({ key: 'embedkit.serial.shortcuts', reason: 'invalid-json' }),
      expect.objectContaining({ key: 'embedkit.network.send-history', reason: 'unexpected-shape' }),
    ]);
    expect(JSON.stringify(report)).not.toContain('secret malformed value');
  });

  it('accepts valid settings including the numeric shortcut limit', () => {
    localStorage.setItem('embedkit.tool-preferences', JSON.stringify({ version: 1, favorites: [], recent: [] }));
    localStorage.setItem('embedkit.serial.shortcut-limit', '20');
    localStorage.setItem('embedkit.automation.suites', '[]');
    expect(inspectStorageHealth().issues).toEqual([]);
  });

  it('removes only entries that are still broken when cleanup is confirmed', () => {
    localStorage.setItem('embedkit.serial.shortcuts', '{broken');
    localStorage.setItem('embedkit.network.send-history', '{broken');
    const report = inspectStorageHealth();
    localStorage.setItem('embedkit.network.send-history', '[]');

    const result = clearStillBrokenSettings(report);

    expect(result.removed).toBe(1);
    expect(localStorage.getItem('embedkit.serial.shortcuts')).toBeNull();
    expect(localStorage.getItem('embedkit.network.send-history')).toBe('[]');
    expect(result.report.issues).toEqual([]);
  });
});
