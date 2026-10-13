import { describe, expect, it } from 'vitest';
import { calculateCrcBatch, calculateCrcRange, calculateCrcSummary, CRC_PRESETS, generateCrcC } from './crc';

describe('CRC tool domain', () => {
  it('matches the standard 123456789 check vectors', () => {
    expect(calculateCrcSummary('123456789', 'text')).toMatchObject({ length: '9', crc16: '0x4B37', wire: '37 4B', crc32: '0xCBF43926' });
  });

  it('parses HEX input and reports reversed byte order', () => {
    expect(calculateCrcSummary('01 02 A0', 'hex').reverse).toBe('A0 02 01');
    expect(() => calculateCrcSummary('01 ZZ', 'hex')).toThrow();
  });

  it('supports catalogue-style CRC parameters and explicit byte ranges', () => {
    expect(calculateCrcRange('123456789', 'text', CRC_PRESETS['crc16-modbus']).hex).toBe('0x4B37');
    expect(calculateCrcRange('123456789', 'text', CRC_PRESETS['crc16-ccitt-false']).hex).toBe('0x29B1');
    expect(calculateCrcRange('AA 31 32 33 34 35 36 37 38 39 FF', 'hex', CRC_PRESETS['crc32-iso-hdlc'], 1, 10).hex).toBe('0xCBF43926');
  });

  it('isolates invalid rows in batch mode and limits unsafe ranges', () => {
    const rows = calculateCrcBatch('01 03\ninvalid\n12 34', 'hex', CRC_PRESETS['crc16-modbus']);
    expect(rows.map(row => Boolean(row.result))).toEqual([true, false, true]);
    expect(() => calculateCrcRange('01 02', 'hex', CRC_PRESETS['crc16-modbus'], 0, 3)).toThrow(/校验范围/);
  });

  it('generates portable C with traceable model parameters', () => {
    const code = generateCrcC(CRC_PRESETS['crc16-modbus']);
    expect(code).toContain('CRC-16/MODBUS');
    expect(code).toContain('0xA001u');
  });
});
