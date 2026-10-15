import { describe, expect, it } from 'vitest';
import { decodeProtocolFields, extractProtocolFields, normalizeProtocolFields } from './protocolFields';

describe('protocol field model', () => {
  it('extracts a generic spreadsheet field table with source locations', () => {
    const fields = extractProtocolFields('[[来源:XLSX 工作表 Data 行 1]]\n字段\t偏移\t长度\t类型\t字节序\t倍率\t单位\t枚举\n[[来源:XLSX 工作表 Data 行 2]]\n温度\t0\t2\tuint16\t小端\t0.1\t℃\t\n[[来源:XLSX 工作表 Data 行 3]]\n状态\t2\t1\tu8\t\t1\t\t0=关闭;1=开启');
    expect(fields).toHaveLength(2);
    expect(fields[0]).toMatchObject({ name: '温度', offset: 0, length: 2, type: 'uint', endian: 'little', scale: 0.1, unit: '℃', source: { location: 'XLSX 工作表 Data 行 2' } });
    expect(fields[1].enum).toEqual({ '0': '关闭', '1': '开启' });
  });

  it('deterministically decodes endian, signed, scale, enum, ASCII and bounds', () => {
    const fields = extractProtocolFields('字段,偏移,长度,类型,字节序,倍率,偏置,单位,枚举\n温度,0,2,int16,小端,0.1,0,℃,\n状态,2,1,u8,大端,1,0,,0=关闭;1=开启\n名称,3,2,ASCII,大端,1,0,,\n越界,8,1,u8,大端,1,0,,');
    const decoded = decodeProtocolFields(Uint8Array.from([0x9c, 0xff, 1, 0x4f, 0x4b]), fields);
    expect(decoded.map((item) => item.display)).toEqual(['-10 ℃', '开启', 'OK', '越界']);
    expect(decoded[3].error).toMatch(/实际负载仅 5 字节/);
  });

  it('rejects unsafe persisted numeric widths', () => {
    const field = extractProtocolFields('字段,偏移,长度,类型\n数值,0,8,uint64')[0];
    expect(field.type).toBe('hex');
    expect(normalizeProtocolFields([{ ...field, type: 'uint' }])).toBeNull();
  });

  it('reports invalid BCD nibbles instead of returning a plausible value', () => {
    const fields = extractProtocolFields('字段,偏移,长度,类型\n日期,0,2,BCD');
    const [decoded] = decodeProtocolFields(Uint8Array.from([0x20, 0x2a]), fields);
    expect(decoded).toMatchObject({ display: '解析错误', error: '包含非 BCD 数字' });
  });

  it('rejects overlapping non-bit fields while permitting bit views', () => {
    const fields = extractProtocolFields('字段,偏移,长度,类型\nA,0,2,uint16\nB,1,2,uint16');
    expect(normalizeProtocolFields(fields)).toBeNull();
    expect(normalizeProtocolFields([{ ...fields[0], type: 'bits', bitOffset: 0, bitLength: 4 }, fields[1]])).not.toBeNull();
  });
});
