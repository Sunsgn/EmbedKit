import { describe, expect, it } from 'vitest';
import { parseSrec } from './srec';

function record(type: number, address: number, width: number, data: number[] = []) {
  const addressData = Array.from({ length: width }, (_, index) => (address >>> ((width - index - 1) * 8)) & 0xff);
  const count = width + data.length + 1, body = [count, ...addressData, ...data];
  const checksum = 0xff - (body.reduce((sum, byte) => sum + byte, 0) & 0xff);
  return `S${type}${[...body, checksum].map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join('')}`;
}
const sample = [0x7af0, 0x7b00, 0x7c00, 0x7d00].map((address, block) => record(1, address, 2, Array.from({ length: 16 }, (_, index) => block * 16 + index))).concat(record(5, 4, 2), record(9, 0, 2)).join('\n');
describe('Motorola SREC tool domain', () => {
  it('parses S1 data, count and termination records', () => {
    const result = parseSrec(sample);
    expect(result).toMatchObject({ records: 6, dataRecords: 4, dataBytes: 64, minAddress: 0x7af0, maxAddress: 0x7d0f, startAddress: 0, countRecord: 4, dataTypes: ['S1'] });
    expect(result.binary.length).toBe(0x220);
    expect(result.binary[0]).toBe(0);
    expect(result.binary[16]).toBe(16);
  });
  it('fills address gaps with FF', () => {
    const result = parseSrec([record(1, 0x10, 2, [1, 2]), record(1, 0x14, 2, [3, 4]), record(5, 2, 2), record(9, 0, 2)].join('\n'));
    expect([...result.binary]).toEqual([1, 2, 0xff, 0xff, 3, 4]);
  });
  it('rejects checksum, count and overlapping-data errors', () => {
    expect(() => parseSrec(`${sample.slice(0, -1)}0`)).toThrow('校验和');
    expect(() => parseSrec(sample.replace(record(5, 4, 2), record(5, 3, 2)))).toThrow('声明 3');
    expect(() => parseSrec([record(1, 0x10, 2, [1, 2]), record(1, 0x10, 2, [0xff])].join('\n'))).toThrow('冲突');
  });
  it('rejects sparse images beyond the browser safety limit', () => {
    expect(() => parseSrec([record(3, 0, 4, [1]), record(3, 0x01000001, 4, [1])].join('\n'))).toThrow('16 MiB');
  });
});
