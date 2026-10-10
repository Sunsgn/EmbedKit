import { describe, expect, it } from 'vitest';
import { calculateAdc } from './adc';

describe('ADC and divider tool domain', () => {
  it('calculates quantization and divider source voltage', () => {
    const result = calculateAdc(12, 3.3, 2048, 10_000, 10_000);
    expect(result.maxCode).toBe(4095);
    expect(result.pinVoltage).toBeCloseTo(1.6504, 4);
    expect(result.sourceVoltage).toBeCloseTo(3.3008, 4);
    expect(result.percent).toBeCloseTo(50.0122, 4);
  });

  it('handles zero and full-scale codes', () => {
    expect(calculateAdc(8, 5, 0).pinVoltage).toBe(0);
    expect(calculateAdc(8, 5, 255).pinVoltage).toBe(5);
  });

  it('rejects invalid resolution, voltage, code and divider values', () => {
    expect(() => calculateAdc(0, 3.3, 0)).toThrow('1 到 32');
    expect(() => calculateAdc(12, 0, 0)).toThrow('大于 0');
    expect(() => calculateAdc(12, 3.3, 4096)).toThrow('0 到 4095');
    expect(() => calculateAdc(12, 3.3, 0, 1, 0)).toThrow('下拉电阻大于 0');
  });
});
