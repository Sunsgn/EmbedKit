import { describe, expect, it } from 'vitest';
import { analyzeBinary } from './bin';

describe('BIN file tool domain', () => {
  it('summarizes size, CRC32 and blank byte counts', () => {
    expect(analyzeBinary(Uint8Array.from([0, 0xff, 1, 0xff]))).toMatchObject({ size: 4, crc32: 0xabc5353d, zeroBytes: 1, erasedBytes: 2 });
  });

  it('returns safe empty previews for an empty file', () => {
    const result = analyzeBinary(new Uint8Array());
    expect(result.size).toBe(0);
    expect([...result.head]).toEqual([]);
    expect([...result.tail]).toEqual([]);
  });

  it('limits head and tail previews without changing input', () => {
    const bytes = Uint8Array.from({ length: 64 }, (_, index) => index);
    const before = [...bytes];
    const result = analyzeBinary(bytes);
    expect([...result.head]).toEqual(before.slice(0, 32));
    expect([...result.tail]).toEqual(before.slice(-16));
    expect([...bytes]).toEqual(before);
  });
});
