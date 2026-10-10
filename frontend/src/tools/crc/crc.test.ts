import { describe, expect, it } from 'vitest';
import { calculateCrcSummary } from './crc';

describe('CRC tool domain', () => {
  it('matches the standard 123456789 check vectors', () => {
    expect(calculateCrcSummary('123456789', 'text')).toMatchObject({ length: '9', crc16: '0x4B37', wire: '37 4B', crc32: '0xCBF43926' });
  });

  it('parses HEX input and reports reversed byte order', () => {
    expect(calculateCrcSummary('01 02 A0', 'hex').reverse).toBe('A0 02 01');
    expect(() => calculateCrcSummary('01 ZZ', 'hex')).toThrow();
  });
});
