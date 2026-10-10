import { describe, expect, it } from 'vitest';
import { convertInteger } from './number';

describe('integer conversion tool domain', () => {
  it('converts integers larger than the JavaScript safe integer range', () => {
    expect(convertInteger('FFFFFFFFFFFFFFFF', 16)).toEqual({
      decimal: '18446744073709551615',
      hex: '0xFFFFFFFFFFFFFFFF',
      binary: `0b${'1'.repeat(64)}`,
      octal: '0o1777777777777777777777',
    });
  });

  it('preserves the sign in every representation', () => {
    expect(convertInteger('-255', 10)).toEqual({
      decimal: '-255',
      hex: '-0xFF',
      binary: '-0b11111111',
      octal: '-0o377',
    });
  });

  it('accepts matching prefixes and digit separators', () => {
    expect(convertInteger('0xFF', 16).decimal).toBe('255');
    expect(convertInteger('1111_0000', 2).hex).toBe('0xF0');
  });

  it('rejects empty, mismatched and invalid input', () => {
    expect(() => convertInteger('  ', 10)).toThrow('请输入数值');
    expect(() => convertInteger('0xFF', 10)).toThrow('输入与当前进制不匹配');
    expect(() => convertInteger('0b10', 10)).toThrow('输入与当前进制不匹配');
    expect(() => convertInteger('12G4', 16)).toThrow('输入与当前进制不匹配');
  });
});
