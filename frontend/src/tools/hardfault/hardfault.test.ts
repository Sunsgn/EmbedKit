import { describe, expect, it } from 'vitest';
import { analyzeHardFault, extractHardFaultLog, parseRegister } from './hardfault';

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
  it('extracts stacked and SCB registers from mixed debugger logs with line evidence', () => {
    const result = extractHardFaultLog(`HardFault captured\nstacked_r0 = 0x00000001 R1: 00000002\nR2 00000003 R3=00000004 R12:0000000C\nLR = FFFFFFF9 PC = 08001234 xPSR = 01000000\nSCB->CFSR = 00008200 HFSR: 40000000 BFAR=20010000`);
    expect(result.registers).toMatchObject({ r0: 1, r12: 12, lr: 0xfffffff9, pc: 0x08001234, cfsr: 0x8200, hfsr: 0x40000000, bfar: 0x20010000 });
    expect(result.confidence).toBe('high');
    expect(result.evidence.find(item => item.register === 'pc')?.line).toBe(4);
  });
  it('reports missing evidence and conflicting values without guessing', () => {
    const result = extractHardFaultLog('PC=08001000 LR=FFFFFFF9\nFault_PC=08002000');
    expect(result.registers.pc).toBe(0x08002000);
    expect(result.warnings[0]).toContain('不同值');
    expect(result.missing).toContain('cfsr');
    expect(result.confidence).toBe('medium');
    expect(() => extractHardFaultLog('panic without registers')).toThrow(/未识别/);
  });
});
