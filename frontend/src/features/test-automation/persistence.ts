import { createDefaultTestSuites, type SerialConnectionConfig, type TestSuite } from './domain';

export const TEST_SUITE_STORAGE_KEY = 'embedkit.automation.suites';
export const SERIAL_CONFIG_STORAGE_KEY = 'embedkit.automation.serial-config.v1';

export const defaultSerialConnection = (): SerialConnectionConfig => ({ path: '', baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });

export function loadSerialConfigs(storage: Storage = localStorage): Record<'serial-a' | 'serial-b', SerialConnectionConfig> {
  const fallback = { 'serial-a': defaultSerialConnection(), 'serial-b': defaultSerialConnection() };
  try {
    const saved = JSON.parse(storage.getItem(SERIAL_CONFIG_STORAGE_KEY) ?? 'null') as Partial<Record<'serial-a' | 'serial-b', Partial<SerialConnectionConfig>>> | null;
    if (!saved) return fallback;
    for (const channel of ['serial-a', 'serial-b'] as const) {
      const value = saved[channel];
      if (!value) continue;
      fallback[channel] = { path: typeof value.path === 'string' ? value.path.slice(0, 260) : '', baudRate: Number.isInteger(value.baudRate) && Number(value.baudRate) >= 50 && Number(value.baudRate) <= 4_000_000 ? Number(value.baudRate) : 115200, dataBits: value.dataBits === 7 ? 7 : 8, stopBits: value.stopBits === 2 ? 2 : 1, parity: value.parity === 'even' || value.parity === 'odd' ? value.parity : 'none', flowControl: value.flowControl === 'hardware' ? 'hardware' : 'none' };
    }
  } catch { /* damaged local data safely falls back */ }
  return fallback;
}

export function loadTestSuites(storage: Storage = localStorage) {
  try { const value = JSON.parse(storage.getItem(TEST_SUITE_STORAGE_KEY) || 'null') as TestSuite[] | null; return value?.length ? value : createDefaultTestSuites(); }
  catch { return createDefaultTestSuites(); }
}

export function saveTestSuites(suites: TestSuite[], storage: Storage = localStorage) {
  const portable = suites.map(suite => ({ ...suite, variables: suite.variables?.map(variable => variable.secret ? { ...variable, value: '' } : variable) }));
  storage.setItem(TEST_SUITE_STORAGE_KEY, JSON.stringify(portable));
}

export function saveSerialConfigs(configs: Record<'serial-a' | 'serial-b', SerialConnectionConfig>, storage: Storage = localStorage) {
  storage.setItem(SERIAL_CONFIG_STORAGE_KEY, JSON.stringify(configs));
}
