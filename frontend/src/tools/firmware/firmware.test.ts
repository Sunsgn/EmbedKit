import { describe, expect, it } from 'vitest';
import { buildFirmwareManifest, compareFirmware, decodeFirmwareArtifact, mergeFirmware } from './firmware';

describe('firmware merge and compare domain', () => {
  it('merges addressed segments and fills gaps', () => {
    const result = mergeFirmware([{ name: 'boot', address: 0x8000, bytes: Uint8Array.of(1, 2) }, { name: 'app', address: 0x8004, bytes: Uint8Array.of(3, 4) }]);
    expect(result.baseAddress).toBe(0x8000); expect([...result.bytes]).toEqual([1, 2, 0xff, 0xff, 3, 4]);
    expect(result).toMatchObject({ dataBytes: 4, holes: [{ startAddress: 0x8002, endAddress: 0x8003, bytes: 2 }] });
  });
  it('rejects conflicting overlap and supports explicit policies', () => {
    const parts = [{ name: 'a', address: 0, bytes: Uint8Array.of(1, 2) }, { name: 'b', address: 1, bytes: Uint8Array.of(9) }];
    expect(() => mergeFirmware(parts)).toThrow('地址 0x1');
    expect([...mergeFirmware(parts, 'keep-first').bytes]).toEqual([1, 2]);
    expect([...mergeFirmware(parts, 'keep-last').bytes]).toEqual([1, 9]);
  });
  it('reports continuous absolute difference ranges', () => {
    const result = compareFirmware(Uint8Array.of(1, 2, 3, 4), 0x1000, Uint8Array.of(1, 9, 8, 4, 5), 0x1000);
    expect(result).toMatchObject({ identical: false, changedBytes: 3, differences: [{ startAddress: 0x1001, endAddress: 0x1002, changedBytes: 2 }, { startAddress: 0x1004, endAddress: 0x1004, changedBytes: 1 }] });
  });
  it('recognizes identical inputs and limits sparse merges', () => {
    expect(compareFirmware(Uint8Array.of(1), 4, Uint8Array.of(1), 4).identical).toBe(true);
    expect(() => mergeFirmware([{ name: 'a', address: 0, bytes: Uint8Array.of(1) }, { name: 'b', address: 0x3000000, bytes: Uint8Array.of(1) }])).toThrow('32 MiB');
    expect(() => compareFirmware(Uint8Array.of(1), 0, Uint8Array.of(1), 0x3000000)).toThrow('32 MiB');
  });
  it('normalizes Intel HEX, SREC, and BIN into real addressed segments', () => {
    const hex = decodeFirmwareArtifact('app.hex', new TextEncoder().encode(':020000040800F2\n:020000000102FB\n:020004000304F3\n:00000001FF'));
    expect(hex.format).toBe('intel-hex');
    expect(hex.segments.map(item => [item.address, [...item.bytes]])).toEqual([[0x08000000, [1, 2]], [0x08000004, [3, 4]]]);
    const srec = decodeFirmwareArtifact('boot.s19', new TextEncoder().encode('S10500100102E7\nS9030000FC'));
    expect(srec).toMatchObject({ format: 'motorola-srec', startAddress: 0 });
    expect(srec.segments[0].address).toBe(0x10);
    const bin = decodeFirmwareArtifact('raw.bin', Uint8Array.of(9, 8), 0x2000);
    expect(bin.segments[0]).toMatchObject({ address: 0x2000, bytes: Uint8Array.of(9, 8) });
  });
  it('exports an auditable manifest without firmware bytes or paths', () => {
    const segments = [{ name: 'C:\\secret\\boot.bin', address: 0x1000, bytes: Uint8Array.of(1, 2) }, { name: '/tmp/app.bin', address: 0x1004, bytes: Uint8Array.of(3) }];
    const result = mergeFirmware(segments), manifest = buildFirmwareManifest(result, segments, { fill: 0xff, policy: 'reject', generatedAt: '2026-10-13T00:00:00.000Z' });
    expect(manifest).toMatchObject({ schema: 'embedkit.firmware-manifest.v1', range: { dataBytes: 3, imageBytes: 5 }, segments: [{ name: 'boot.bin' }, { name: 'app.bin' }] });
    const serialized = JSON.stringify(manifest);
    expect(serialized).not.toContain('secret'); expect(serialized).not.toContain('[1,2]');
  });
});
