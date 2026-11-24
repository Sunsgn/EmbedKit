import { describe, expect, it } from 'vitest';
import { createBrowserSerialCsvLog, createBrowserSerialRawRx, createBrowserSerialTextLog } from './browserSerialExport';

describe('browser serial export', () => {
  const session = { name: 'COM7,"USB"', entries: [{ timestamp: '12:00:00.000', direction: 'rx' as const, text: 'OK', bytes: [0x4f, 0x4b] }, { timestamp: '12:00:01.000', direction: 'tx' as const, text: 'AT' }] };
  it('creates deterministic text and escaped CSV evidence', () => {
    expect(createBrowserSerialTextLog(session, true)).toContain('[RX] 4F 4B');
    const csv = createBrowserSerialCsvLog(session);
    expect(csv).toContain('"COM7,""USB"""');
    expect(csv).toContain(',2,"4F 4B"');
  });
  it('extracts only RX bytes for raw export', () => {
    expect(createBrowserSerialRawRx([{ direction: 'tx', hex: 'AA' }, { direction: 'rx', hex: '4F 4B' }])).toEqual(Uint8Array.from([0x4f, 0x4b]));
  });
});
