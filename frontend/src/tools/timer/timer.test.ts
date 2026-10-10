import { describe, expect, it } from 'vitest';
import { calculateTimerPwm } from './timer';

describe('timer and PWM tool domain', () => {
  it('calculates counter frequency, PWM frequency and duty cycle', () => {
    expect(calculateTimerPwm(72_000_000, 71, 999, 250)).toEqual({
      counterClockHz: 1_000_000,
      frequencyHz: 1_000,
      periodUs: 1_000,
      dutyPercent: 25,
      resolutionNs: 1_000,
    });
  });

  it('supports zero and full duty-cycle boundaries', () => {
    expect(calculateTimerPwm(1_000_000, 0, 999, 0).dutyPercent).toBe(0);
    expect(calculateTimerPwm(1_000_000, 0, 999, 1000).dutyPercent).toBe(100);
  });

  it('rejects invalid clock and register values', () => {
    expect(() => calculateTimerPwm(0, 0, 0, 0)).toThrow('大于 0');
    expect(() => calculateTimerPwm(1_000_000, -1, 999, 0)).toThrow('非负整数');
    expect(() => calculateTimerPwm(1_000_000, 0.5, 999, 0)).toThrow('非负整数');
    expect(() => calculateTimerPwm(1_000_000, 0, 999, 1001)).toThrow('ARR + 1');
  });
});
