import { describe, expect, it } from 'vitest';
import { analyzeHardFault, parseRegister } from './hardfault';

const base = { r0: 0, r1: 0, r2: 0, r3: 0, r12: 0, lr: 0xfffffff9, pc: 0x08001234, xpsr: 0x01000000, cfsr: 0, hfsr: 0 };
describe('Cortex-M HardFault domain', () => {
  it('decodes a forced precise bus fault and its valid address', () => {
    const result = analyzeHardFault({ ...base, cfsr: (1 << 9) | (1 << 15), hfsr: 2 ** 30, bfar: 0x20010000 });
    expect(result.findings.map(item => item.code)).toEqual(['PRECISERR', 'BFARVALID', 'FORCED']);
    expect(result.addresses).toContainEqual({ kind: 'PC', value: 0x08001234, sourceReady: true });
    expect(result.addresses).toContainEqual({ kind: 'BFAR', value: 0x20010000, sourceReady: false });
  });
  it('reports usage faults and a suspicious Thumb state', () => {
    const result = analyzeHardFault({ ...base, xpsr: 0, cfsr: (1 << 16) | (1 << 25) });
    expect(result.findings.map(item => item.code)).toEqual(['UNDEFINSTR', 'DIVBYZERO']);
    expect(result.warnings[0]).toContain('Thumb');
  });
  it('accepts hexadecimal register notation and rejects bad values', () => {
    expect(parseRegister('0x0800_1234')).toBe(0x08001234);
    expect(() => parseRegister('xyz')).toThrow('无效寄存器值');
    expect(() => analyzeHardFault({ ...base, pc: -1 })).toThrow('PC');
  });
});
