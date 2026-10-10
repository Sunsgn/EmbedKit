import { describe, expect, it } from 'vitest';
import { compareFirmware, mergeFirmware } from './firmware';

describe('firmware merge and compare domain', () => {
  it('merges addressed segments and fills gaps', () => {
    const result = mergeFirmware([{ name: 'boot', address: 0x8000, bytes: Uint8Array.of(1, 2) }, { name: 'app', address: 0x8004, bytes: Uint8Array.of(3, 4) }]);
    expect(result.baseAddress).toBe(0x8000); expect([...result.bytes]).toEqual([1, 2, 0xff, 0xff, 3, 4]);
  });
  it('rejects conflicting overlap and supports explicit policies', () => {
    const parts = [{ name: 'a', address: 0, bytes: Uint8Array.of(1, 2) }, { name: 'b', address: 1, bytes: Uint8Array.of(9) }];
    expect(() => mergeFirmware(parts)).toThrow('地址 0x1');
    expect([...mergeFirmware(parts, 'keep-first').bytes]).toEqual([1, 2]);
    expect([...mergeFirmware(parts, 'keep-last').bytes]).toEqual([1, 9]);
  });
  it('reports continuous absolute difference ranges', () => {
    const result = compareFirmware(Uint8Array.of(1, 2, 3, 4), 0x1000, Uint8Array.of(1, 9, 8, 4, 5), 0x1000);
    expect(result).toMatchObject({ identical: false, changedBytes: 3, differences: [{ startAddress: 0x1001, endAddress: 0x1002, changedBytes: 2 }, { startAddress: 0x1004, endAddress: 0x1004, changedBytes: 1 }] });
  });
  it('recognizes identical inputs and limits sparse merges', () => {
    expect(compareFirmware(Uint8Array.of(1), 4, Uint8Array.of(1), 4).identical).toBe(true);
    expect(() => mergeFirmware([{ name: 'a', address: 0, bytes: Uint8Array.of(1) }, { name: 'b', address: 0x3000000, bytes: Uint8Array.of(1) }])).toThrow('32 MiB');
    expect(() => compareFirmware(Uint8Array.of(1), 0, Uint8Array.of(1), 0x3000000)).toThrow('32 MiB');
  });
});
