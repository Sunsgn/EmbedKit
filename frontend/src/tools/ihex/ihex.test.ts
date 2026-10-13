import { describe, expect, it } from 'vitest';
import { parseIntelHex } from './ihex';

describe('Intel HEX tool domain', () => {
  it('parses extended linear addresses and fills BIN gaps with FF', () => {
    const result = parseIntelHex(':020000040800F2\n:020000000102FB\n:020004000304F3\n:00000001FF');
    expect(result).toMatchObject({ records: 4, dataRecords: 2, dataBytes: 4, minAddress: 0x08000000, maxAddress: 0x08000005, eof: true });
    expect([...result.binary]).toEqual([1, 2, 0xff, 0xff, 3, 4]);
    expect(result.segments.map(item => [item.address, [...item.bytes]])).toEqual([[0x08000000, [1, 2]], [0x08000004, [3, 4]]]);
  });

  it('parses a start linear address record', () => {
    expect(parseIntelHex(':0400000508000010DF\n:00000001FF').startAddress).toBe(0x08000010);
  });

  it('rejects missing markers, bad lengths and bad checksums', () => {
    expect(() => parseIntelHex('00000001FF')).toThrow('缺少冒号');
    expect(() => parseIntelHex(':0200000001FD')).toThrow('长度');
    expect(() => parseIntelHex(':020000000102FC')).toThrow('校验和');
  });

  it('rejects sparse images exceeding the safe browser span', () => {
    expect(() => parseIntelHex(':020000040000FA\n:0100000001FE\n:020000040101F8\n:0100000001FE\n:00000001FF')).toThrow('16 MiB');
  });

  it('rejects conflicting overlapping records instead of silently overwriting bytes', () => {
    expect(() => parseIntelHex(':0100000001FE\n:0100000002FD\n:00000001FF')).toThrow('冲突');
  });
});
