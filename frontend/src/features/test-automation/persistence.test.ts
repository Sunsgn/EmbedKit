import { describe, expect, it } from 'vitest';
import { loadSerialConfigs, loadTestSuites, saveTestSuites } from './persistence';

describe('test automation persistence', () => {
  it('recovers damaged suites and serial settings without blocking the workspace', () => {
    const storage = new Map<string, string>([['embedkit.automation.suites', '{bad'], ['embedkit.automation.serial-config.v1', '{bad']]);
    const adapter = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key), clear: () => storage.clear(), key: () => null, length: storage.size } satisfies Storage;
    expect(loadTestSuites(adapter)[0].cases[0].steps).toHaveLength(1);
    expect(loadSerialConfigs(adapter)['serial-a']).toMatchObject({ baudRate: 115200, dataBits: 8 });
  });

  it('never persists secret variable values', () => {
    const storage = new Map<string, string>();
    const adapter = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key), clear: () => storage.clear(), key: () => null, length: storage.size } satisfies Storage;
    saveTestSuites([{ id: 'suite', name: 'suite', cases: [], variables: [{ id: 'secret', name: 'TOKEN', value: 'private', secret: true }] }], adapter);
    expect(storage.get('embedkit.automation.suites')).not.toContain('private');
  });
});
