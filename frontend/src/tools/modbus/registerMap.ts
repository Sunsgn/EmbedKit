import type { ModbusResponse } from './modbus';

export type ModbusArea = 'coil' | 'discrete' | 'holding' | 'input';
export type ModbusValueType = 'bool' | 'u16' | 'i16' | 'u32' | 'i32' | 'f32' | 'ascii';

export interface ModbusRegisterDefinition {
  name: string;
  area: ModbusArea;
  address: number;
  type: ModbusValueType;
  length: number;
  scale: number;
  offset: number;
  unit: string;
  byteOrder: 'big' | 'little';
  wordOrder: 'high-low' | 'low-high';
  sourceLine: number;
}

export interface ModbusDecodedValue extends ModbusRegisterDefinition {
  raw: string;
  value: string;
}

const headerAliases: Record<string, string[]> = {
  name: ['name', '名称', '变量', '参数', '寄存器名称'], area: ['area', '区域', '区', '功能码', 'function', 'fc'], address: ['address', '地址', '寄存器地址', '寄存器'],
  type: ['type', '类型', '数据类型', 'datatype'], length: ['length', '长度', '寄存器数', '字数'], scale: ['scale', '倍率', '系数', '缩放'], offset: ['offset', '偏移'], unit: ['unit', '单位'],
  byteOrder: ['byteorder', '字节序', 'byte order'], wordOrder: ['wordorder', '字序', 'word order'],
};
const functionAreas: Record<number, ModbusArea> = { 1: 'coil', 2: 'discrete', 3: 'holding', 4: 'input' };

function splitRow(line: string, delimiter: string) {
  const values: string[] = []; let value = '', quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { values.push(value.trim()); value = ''; }
    else value += char;
  }
  values.push(value.trim()); return values;
}

function normalizedHeader(value: string) { return value.trim().toLowerCase().replace(/[ _-]/g, ''); }
function headerIndex(headers: string[], field: string) { const aliases = headerAliases[field].map(normalizedHeader); return headers.findIndex(header => aliases.includes(normalizedHeader(header))); }

function parseArea(value: string): ModbusArea | null {
  const normalized = value.trim().toLowerCase();
  if (/^(?:1|01|coil|线圈)$/.test(normalized)) return 'coil';
  if (/^(?:2|02|discrete|离散输入)$/.test(normalized)) return 'discrete';
  if (/^(?:3|03|holding|保持寄存器)$/.test(normalized)) return 'holding';
  if (/^(?:4|04|input|输入寄存器)$/.test(normalized)) return 'input';
  return null;
}

function parseAddress(value: string, explicitArea: ModbusArea | null) {
  const address = /^0x/i.test(value) ? Number.parseInt(value.slice(2), 16) : Number(value);
  if (!Number.isInteger(address) || address < 0 || address > 499999) throw new Error(`地址“${value}”无效`);
  if (address >= 40001 && address <= 49999) return { area: explicitArea ?? 'holding' as ModbusArea, address: address - 40001 };
  if (address >= 30001 && address <= 39999) return { area: explicitArea ?? 'input' as ModbusArea, address: address - 30001 };
  if (address >= 10001 && address <= 19999) return { area: explicitArea ?? 'discrete' as ModbusArea, address: address - 10001 };
  if (address >= 1 && address <= 9999 && !explicitArea) return { area: 'coil' as ModbusArea, address: address - 1 };
  return { area: explicitArea ?? 'holding' as ModbusArea, address };
}

function parseType(value: string): ModbusValueType {
  const normalized = value.trim().toLowerCase().replace(/[_ -]/g, '');
  const aliases: Record<string, ModbusValueType> = { bool: 'bool', boolean: 'bool', u16: 'u16', uint16: 'u16', word: 'u16', i16: 'i16', int16: 'i16', u32: 'u32', uint32: 'u32', dword: 'u32', i32: 'i32', int32: 'i32', f32: 'f32', float: 'f32', float32: 'f32', ascii: 'ascii', string: 'ascii', 字符串: 'ascii' };
  const result = aliases[normalized]; if (!result) throw new Error(`不支持数据类型“${value}”`); return result;
}

export function parseRegisterMap(source: string): { definitions: ModbusRegisterDefinition[]; warnings: string[] } {
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/).map((text, index) => ({ text: text.trim(), line: index + 1 })).filter(item => item.text && !item.text.startsWith('#'));
  if (lines.length < 2) throw new Error('协议表至少需要表头和一行数据');
  const delimiter = lines[0].text.includes('\t') ? '\t' : lines[0].text.includes(';') && !lines[0].text.includes(',') ? ';' : ',';
  const headers = splitRow(lines[0].text, delimiter), indexes = Object.fromEntries(Object.keys(headerAliases).map(field => [field, headerIndex(headers, field)]));
  if (indexes.name < 0 || indexes.address < 0) throw new Error('协议表必须包含“名称/name”和“地址/address”列');
  const warnings: string[] = [], definitions: ModbusRegisterDefinition[] = [];
  for (const row of lines.slice(1)) {
    try {
      const cells = splitRow(row.text, delimiter), read = (field: string) => indexes[field] < 0 ? '' : cells[indexes[field]] ?? '';
      const explicitArea = parseArea(read('area')), located = parseAddress(read('address'), explicitArea), type = parseType(read('type') || (located.area === 'coil' || located.area === 'discrete' ? 'bool' : 'u16'));
      const defaultLength = type === 'u32' || type === 'i32' || type === 'f32' ? 2 : 1, length = Number(read('length') || defaultLength), scale = Number(read('scale') || 1), offset = Number(read('offset') || 0);
      if (!read('name')) throw new Error('名称为空');
      if (!Number.isInteger(length) || length < 1 || length > 125) throw new Error('长度必须是 1 到 125');
      if (!Number.isFinite(scale) || !Number.isFinite(offset)) throw new Error('倍率或偏移无效');
      const byteText = read('byteOrder').toLowerCase(), wordText = read('wordOrder').toLowerCase();
      definitions.push({ name: read('name'), area: located.area, address: located.address, type, length, scale, offset, unit: read('unit'), byteOrder: /^(?:little|le|小端|ba)$/.test(byteText) ? 'little' : 'big', wordOrder: /^(?:low-high|lowhigh|低字在前|cdab)$/.test(wordText) ? 'low-high' : 'high-low', sourceLine: row.line });
    } catch (reason) { warnings.push(`第 ${row.line} 行：${reason instanceof Error ? reason.message : String(reason)}`); }
  }
  if (!definitions.length) throw new Error(warnings[0] ?? '协议表没有可用数据');
  return { definitions: definitions.slice(0, 2000), warnings: [...warnings, ...(definitions.length > 2000 ? ['协议表超过 2000 项，仅处理前 2000 项'] : [])] };
}

function orderedBytes(bytes: Uint8Array, definition: ModbusRegisterDefinition) {
  const words: number[][] = [];
  for (let index = 0; index < bytes.length; index += 2) { const word = [bytes[index], bytes[index + 1]]; words.push(definition.byteOrder === 'little' ? word.reverse() : word); }
  if (definition.wordOrder === 'low-high') words.reverse();
  return Uint8Array.from(words.flat());
}

export function decodeRegisterMap(response: ModbusResponse, startAddress: number, definitions: ModbusRegisterDefinition[]): { values: ModbusDecodedValue[]; skipped: number } {
  const area = functionAreas[response.functionCode & 0x7f];
  if (!area || response.exception) return { values: [], skipped: definitions.length };
  const values: ModbusDecodedValue[] = []; let skipped = 0;
  for (const definition of definitions) {
    if (definition.area !== area || definition.address < startAddress) { skipped += 1; continue; }
    if (area === 'coil' || area === 'discrete') {
      const bit = definition.address - startAddress, byte = response.data[Math.floor(bit / 8)];
      if (byte === undefined) { skipped += 1; continue; }
      const active = Boolean(byte & (1 << (bit % 8))); values.push({ ...definition, raw: active ? '1' : '0', value: active ? 'true' : 'false' }); continue;
    }
    const byteOffset = (definition.address - startAddress) * 2, byteLength = definition.type === 'ascii' ? definition.length * 2 : definition.type === 'u32' || definition.type === 'i32' || definition.type === 'f32' ? 4 : 2;
    if (byteOffset + byteLength > response.data.length) { skipped += 1; continue; }
    const rawBytes = response.data.slice(byteOffset, byteOffset + byteLength), bytes = orderedBytes(rawBytes, definition), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let rawValue: number | string;
    if (definition.type === 'u16') rawValue = view.getUint16(0, false); else if (definition.type === 'i16') rawValue = view.getInt16(0, false); else if (definition.type === 'u32') rawValue = view.getUint32(0, false); else if (definition.type === 'i32') rawValue = view.getInt32(0, false); else if (definition.type === 'f32') rawValue = view.getFloat32(0, false); else rawValue = new TextDecoder().decode(bytes).replace(/\0+$/, '');
    const value = typeof rawValue === 'number' ? rawValue * definition.scale + definition.offset : rawValue;
    values.push({ ...definition, raw: typeof rawValue === 'number' ? String(rawValue) : rawValue, value: typeof value === 'number' ? Number(value.toPrecision(12)).toString() : value });
  }
  return { values, skipped };
}

export const REGISTER_MAP_TEMPLATE = `名称,区域,地址,类型,长度,倍率,偏移,单位,字节序,字序\n温度,保持寄存器,40001,i16,1,0.1,0,℃,big,high-low\n累计流量,保持寄存器,40002,u32,2,0.01,0,m³,big,low-high`;
