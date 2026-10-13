import { describe, expect, it } from 'vitest';
import { buildCustomFrame, parseCustomFrame, parseFrameStream, type FrameTemplate } from './frame';

const template: FrameTemplate = { header: 'AA 55', commandBytes: 1, includeLength: true, checksum: 'sum8' };
describe('custom protocol frame domain', () => {
  it('builds and parses a field-oriented frame', () => {
    const built = buildCustomFrame(template, 0x10, '01 02');
    expect(built.hex).toBe('AA 55 03 10 01 02 15');
    expect(parseCustomFrame(template, built.hex)).toMatchObject({ command: 0x10, payload: Uint8Array.from([1, 2]) });
    expect(built.fields.map(item => item.offset)).toEqual([0, 2, 3, 4, 6]);
  });
  it('supports XOR8, CRC16-Modbus and no checksum', () => {
    expect(buildCustomFrame({ ...template, checksum: 'xor8' }, 1, '').hex).toBe('AA 55 01 01 FF');
    expect(parseCustomFrame({ ...template, checksum: 'crc16-modbus' }, buildCustomFrame({ ...template, checksum: 'crc16-modbus' }, 2, '03').hex).payload).toEqual(Uint8Array.of(3));
    expect(buildCustomFrame({ ...template, includeLength: false, checksum: 'none' }, 1, '').hex).toBe('AA 55 01');
  });
  it('locates header, length and checksum failures by byte offset', () => {
    expect(() => parseCustomFrame(template, 'AB 55 03 10 01 02 15')).toThrow('字节偏移 0');
    expect(() => parseCustomFrame(template, 'AA 55 04 10 01 02 16')).toThrow('字节偏移 2');
    expect(() => parseCustomFrame(template, 'AA 55 03 10 01 02 00')).toThrow('字节偏移 6');
  });
  it('splits noisy concatenated logs and preserves an incomplete tail', () => {
    const first = buildCustomFrame(template, 0x10, '01 02').hex, second = buildCustomFrame(template, 0x11, '03').hex;
    const result = parseFrameStream(template, `00 FF ${first} 99 ${second} AA 55 03 10`);
    expect(result.frames.map(item => item.result?.command)).toEqual([0x10, 0x11]);
    expect(result.noiseBytes).toBe(3);
    expect(Array.from(result.trailing)).toEqual([0xaa, 0x55, 0x03, 0x10]);
    expect(result.frames.map(item => item.offset)).toEqual([2, 10]);
  });
  it('isolates a bad frame and continues with the next complete frame', () => {
    const valid = buildCustomFrame(template, 0x12, '04').hex;
    const result = parseFrameStream(template, `AA 55 02 10 01 00 ${valid}`);
    expect(result.frames[0].error).toContain('校验错误');
    expect(result.frames[1].result?.command).toBe(0x12);
  });
  it('requires a fixed payload length when stream frames have no length field', () => {
    const fixed = { ...template, includeLength: false, checksum: 'none' as const, fixedPayloadLength: 2 };
    expect(parseFrameStream(fixed, 'AA 55 01 10 11 AA 55 02 20 21').frames).toHaveLength(2);
    expect(() => parseFrameStream({ ...fixed, fixedPayloadLength: undefined }, 'AA 55 01')).toThrow(/固定负载长度/);
  });
});
