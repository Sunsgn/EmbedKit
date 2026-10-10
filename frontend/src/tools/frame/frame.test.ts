import { describe, expect, it } from 'vitest';
import { buildCustomFrame, parseCustomFrame, type FrameTemplate } from './frame';

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
});
