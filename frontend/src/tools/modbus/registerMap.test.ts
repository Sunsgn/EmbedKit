import { describe, expect, it } from 'vitest';
import { decodeRegisterMap, parseRegisterMap, previewRegisterMap } from './registerMap';

describe('Modbus protocol register map', () => {
  it('imports Chinese CSV and converts 4xxxx document addresses', () => {
    const result = parseRegisterMap('名称,区域,地址,类型,倍率,单位\n温度,保持寄存器,40001,i16,0.1,℃');
    expect(result.definitions[0]).toMatchObject({ name: '温度', area: 'holding', address: 0, type: 'i16', scale: 0.1, unit: '℃' });
  });

  it('accepts tab-separated rows copied from a spreadsheet and isolates bad rows', () => {
    const result = parseRegisterMap('name\tarea\taddress\ttype\nPressure\t03\t0x10\tu16\nBad\t03\tnone\tu16');
    expect(result.definitions).toHaveLength(1);
    expect(result.warnings[0]).toContain('第 3 行');
  });

  it('previews document tables and applies explicit mappings for vendor-specific headers', () => {
    const source = '项目说明 | 编号 | 格式 | 量纲\n出口温度 | 40001 | int16 | ℃';
    const preview = previewRegisterMap(source);
    expect(preview).toMatchObject({ headers: ['项目说明', '编号', '格式', '量纲'], confidence: 'low', separator: 'pipe' });
    const result = parseRegisterMap(source, { name: 0, address: 1, type: 2, unit: 3 });
    expect(result.definitions[0]).toMatchObject({ name: '出口温度', address: 0, type: 'i16', unit: '℃' });
  });

  it('recognizes columns separated by repeated spaces after copying from a PDF', () => {
    const preview = previewRegisterMap('名称  地址  类型\n温度  40001  i16');
    expect(preview.separator).toBe('spacing');
    expect(parseRegisterMap('名称  地址  类型\n温度  40001  i16').definitions[0].name).toBe('温度');
  });

  it('decodes scaled signed values and low-word-first float values', () => {
    const definitions = parseRegisterMap('name,area,address,type,scale,wordOrder\nTemp,03,0,i16,0.1,high-low\nFlow,03,1,f32,1,low-high').definitions;
    const result = decodeRegisterMap({ transport: 'rtu', unitId: 1, functionCode: 3, data: Uint8Array.from([0xff, 0x9c, 0x00, 0x00, 0x41, 0x20]) }, 0, definitions);
    expect(result.values.map(item => item.value)).toEqual(['-10', '10']);
  });

  it('decodes coil bits and skips definitions outside the returned range', () => {
    const definitions = parseRegisterMap('name,area,address,type\nRun,01,0,bool\nAlarm,01,3,bool\nFar,01,20,bool').definitions;
    const result = decodeRegisterMap({ transport: 'rtu', unitId: 1, functionCode: 1, data: Uint8Array.from([0b00001001]) }, 0, definitions);
    expect(result.values.map(item => [item.name, item.value])).toEqual([['Run', 'true'], ['Alarm', 'true']]);
    expect(result.skipped).toBe(1);
  });
});
