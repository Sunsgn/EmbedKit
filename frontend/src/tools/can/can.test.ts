import { describe, expect, it } from 'vitest';
import { analyzeCanFrame } from './can';

describe('classic CAN frame tool domain', () => {
  it('analyzes a standard data frame and bus occupancy', () => {
    expect(analyzeCanFrame('123', false, 'DE AD BE EF', 500000)).toMatchObject({
      id: 0x123,
      idHex: '0x123',
      extended: false,
      dlc: 4,
      baseBits: 79,
      worstCaseBits: 95,
      durationUs: 158,
      worstDurationUs: 190,
    });
  });

  it('accepts the largest extended identifier and eight data bytes', () => {
    const result = analyzeCanFrame('0x1FFFFFFF', true, '00 11 22 33 44 55 66 77');
    expect(result.idHex).toBe('0x1FFFFFFF');
    expect(result.dlc).toBe(8);
  });

  it('rejects identifiers and payloads outside classic CAN limits', () => {
    expect(() => analyzeCanFrame('800', false, '')).toThrow('0x7FF');
    expect(() => analyzeCanFrame('20000000', true, '')).toThrow('0x1FFFFFFF');
    expect(() => analyzeCanFrame('123', false, '00 01 02 03 04 05 06 07 08')).toThrow('8 字节');
  });

  it('rejects malformed data and invalid bit rates', () => {
    expect(() => analyzeCanFrame('XYZ', false, '')).toThrow('十六进制数');
    expect(() => analyzeCanFrame('123', false, 'GG')).toThrow('HEX 数据');
    expect(() => analyzeCanFrame('123', false, '', 0)).toThrow('大于 0');
  });
});
