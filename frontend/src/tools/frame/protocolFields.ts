import { formatHex } from '../../utils/embeddedTools';

export type ProtocolFieldType = 'uint' | 'int' | 'bcd' | 'ascii' | 'hex' | 'bits';

export interface ProtocolFieldDefinition {
  id: string;
  name: string;
  offset: number;
  length: number;
  type: ProtocolFieldType;
  endian: 'big' | 'little';
  scale: number;
  bias: number;
  unit: string;
  bitOffset?: number;
  bitLength?: number;
  enum?: Record<string, string>;
  source: { line: number; text: string; location?: string };
  confidence: number;
}

export interface DecodedProtocolField {
  field: ProtocolFieldDefinition;
  rawHex: string;
  rawValue: number | string | null;
  value: number | string | null;
  display: string;
  error: string;
}

const types = new Set<ProtocolFieldType>(['uint', 'int', 'bcd', 'ascii', 'hex', 'bits']);
const clean = (value: string, max = 200) => Array.from(value).filter((character) => character.charCodeAt(0) >= 0x20).join('').trim().slice(0, max);
const aliases = {
  name: /^(字段(?:名|名称)?|参数(?:名|名称)?|名称|name|field|parameter)$/i,
  offset: /^(偏移(?:地址)?|字节偏移|offset|byte\s*offset|位置)$/i,
  length: /^(长度|字节数|占用字节|length|size|bytes?)$/i,
  type: /^(类型|数据类型|格式|type|data\s*type|format)$/i,
  endian: /^(字节序|端序|endian|byte\s*order)$/i,
  scale: /^(倍率|比例|系数|分辨率|scale|factor|resolution)$/i,
  bias: /^(偏置|偏移量|bias|add|offset\s*value)$/i,
  unit: /^(单位|unit)$/i,
  enumeration: /^(枚举|取值|值定义|说明|enum|values?)$/i,
};

function csvCells(line: string) {
  const values: string[] = []; let value = '', quoted = false;
  for (let index = 0; index < line.length; index += 1) { const character = line[index]; if (character === '"') { if (quoted && line[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted; } else if (character === ',' && !quoted) { values.push(value.trim()); value = ''; } else value += character; }
  values.push(value.trim()); return values;
}

function cells(line: string) {
  if (line.includes('\t')) return line.split('\t').map((value) => value.trim());
  if (line.includes('|')) return line.replace(/^\s*\||\|\s*$/g, '').split('|').map((value) => value.trim());
  return line.includes(',') ? csvCells(line) : [];
}

function number(value: string, fallback: number | null = null) {
  const match = value.match(/[-+]?0x[\da-f]+|[-+]?\d+(?:\.\d+)?/i); if (!match) return fallback;
  const parsed = /^[-+]?0x/i.test(match[0]) ? Number.parseInt(match[0], 16) : Number(match[0]); return Number.isFinite(parsed) ? parsed : fallback;
}

function fieldType(value: string, length: number): ProtocolFieldType {
  const lower = value.toLowerCase();
  if (/ascii|string|char|字符|文本/.test(lower)) return 'ascii';
  if (/bcd/.test(lower)) return 'bcd';
  if (/bit|位域|标志/.test(lower)) return 'bits';
  if (/hex|raw|字节数组/.test(lower)) return 'hex';
  if (/int|signed|有符号|s(?:8|16|32|64)\b/.test(lower) && !/uint|unsigned|无符号/.test(lower)) return 'int';
  return length <= 6 ? 'uint' : 'hex';
}

function enumValues(value: string) {
  const result: Record<string, string> = {};
  for (const part of value.split(/[;；,，|]/)) { const match = part.match(/^\s*(0x[\da-f]+|-?\d+)\s*[:=：-]\s*(.+?)\s*$/i); if (match) result[String(number(match[1], 0))] = clean(match[2], 100); }
  return Object.keys(result).length ? result : undefined;
}

export function normalizeProtocolFields(value: unknown): ProtocolFieldDefinition[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 256) return null;
  const result: ProtocolFieldDefinition[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const field = item as Partial<ProtocolFieldDefinition>;
    if (typeof field.name !== 'string' || !Number.isSafeInteger(field.offset) || field.offset! < 0 || field.offset! > 65535 || !Number.isSafeInteger(field.length) || field.length! < 1 || field.length! > 256 || !types.has(field.type as ProtocolFieldType) || !field.source || typeof field.source.text !== 'string' || !Number.isSafeInteger(field.source.line)) return null;
    const scale = typeof field.scale === 'number' && Number.isFinite(field.scale) ? field.scale : 1, bias = typeof field.bias === 'number' && Number.isFinite(field.bias) ? field.bias : 0;
    if ((field.type === 'uint' || field.type === 'int' || field.type === 'bits') && field.length! > 6) return null;
    const bitOffset = Number.isSafeInteger(field.bitOffset) ? Number(field.bitOffset) : 0, bitLength = Number.isSafeInteger(field.bitLength) ? Number(field.bitLength) : field.length! * 8 - bitOffset;
    if (field.type === 'bits' && (bitOffset < 0 || bitLength < 1 || bitLength > 32 || bitOffset + bitLength > field.length! * 8)) return null;
    result.push({ id: clean(String(field.id || `field-${result.length + 1}`)), name: clean(field.name), offset: field.offset!, length: field.length!, type: field.type as ProtocolFieldType, endian: field.endian === 'little' ? 'little' : 'big', scale, bias, unit: clean(String(field.unit ?? ''), 50), ...(field.type === 'bits' ? { bitOffset, bitLength } : {}), ...(field.enum && typeof field.enum === 'object' ? { enum: Object.fromEntries(Object.entries(field.enum).slice(0, 100).map(([key, label]) => [clean(key, 30), clean(String(label), 100)])) } : {}), source: { line: field.source.line, text: clean(field.source.text, 1000), ...(field.source.location ? { location: clean(field.source.location, 300) } : {}) }, confidence: typeof field.confidence === 'number' ? Math.max(0, Math.min(1, field.confidence)) : 0.5 });
  }
  if (new Set(result.map((field) => field.id)).size !== result.length || validateProtocolFields(result).length) return null;
  return result;
}

export function validateProtocolFields(fields: ProtocolFieldDefinition[]) {
  const issues: string[] = [];
  for (let left = 0; left < fields.length; left += 1) for (let right = left + 1; right < fields.length; right += 1) {
    const a = fields[left], b = fields[right];
    if (a.type === 'bits' || b.type === 'bits') continue;
    if (a.offset < b.offset + b.length && b.offset < a.offset + a.length) issues.push(`字段“${a.name}”与“${b.name}”的负载字节范围重叠`);
  }
  return issues;
}

export function extractProtocolFields(source: string) {
  const rows: Array<{ line: number; text: string; location: string; cells: string[] }> = [];
  let location = '';
  source.replace(/\r/g, '').split('\n').forEach((raw, index) => { const value = raw.trim(), sourceMarker = value.match(/^\[\[来源:(.+)\]\]$/); if (sourceMarker) { location = clean(sourceMarker[1], 300); return; } const values = cells(raw); if (values.length > 1 && !values.every((cell) => /^:?-{2,}:?$/.test(cell))) rows.push({ line: index + 1, text: raw, location, cells: values }); });
  const fields: ProtocolFieldDefinition[] = [];
  let columns: Partial<Record<keyof typeof aliases, number>> | null = null;
  for (const row of rows) {
    const detected: Partial<Record<keyof typeof aliases, number>> = {};
    row.cells.forEach((cell, index) => { for (const [key, pattern] of Object.entries(aliases) as Array<[keyof typeof aliases, RegExp]>) if (pattern.test(cell.trim())) detected[key] = index; });
    if (detected.name !== undefined && detected.offset !== undefined && detected.length !== undefined) { columns = detected; continue; }
    if (!columns || fields.length >= 256) continue;
    const name = clean(row.cells[columns.name!] ?? ''), offset = number(row.cells[columns.offset!] ?? ''), lengthValue = row.cells[columns.length!] ?? '', parsedLength = number(lengthValue);
    if (!name || offset === null || parsedLength === null) continue;
    const length = /bit|位/i.test(lengthValue) && !/byte|字节/i.test(lengthValue) ? Math.ceil(parsedLength / 8) : parsedLength;
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length < 1 || length > 256) continue;
    const typeValue = columns.type === undefined ? '' : row.cells[columns.type] ?? '', type = fieldType(typeValue, length);
    const scale = columns.scale === undefined ? 1 : number(row.cells[columns.scale] ?? '', 1)!, bias = columns.bias === undefined ? 0 : number(row.cells[columns.bias] ?? '', 0)!;
    const endianText = columns.endian === undefined ? '' : row.cells[columns.endian] ?? '';
    fields.push({ id: `field-${fields.length + 1}`, name, offset, length, type, endian: /little|小端|低字节.*先/i.test(endianText) ? 'little' : 'big', scale, bias, unit: columns.unit === undefined ? '' : clean(row.cells[columns.unit] ?? '', 50), ...(columns.enumeration === undefined ? {} : { enum: enumValues(row.cells[columns.enumeration] ?? '') }), source: { line: row.line, text: clean(row.text, 1000), ...(row.location ? { location: row.location } : {}) }, confidence: columns.type === undefined ? 0.65 : 0.8 });
  }
  return fields;
}

function unsigned(bytes: Uint8Array, endian: 'big' | 'little') { let value = 0; const ordered = endian === 'little' ? [...bytes].reverse() : [...bytes]; for (const byte of ordered) value = value * 256 + byte; return value; }

export function decodeProtocolFields(payload: Uint8Array, fields: ProtocolFieldDefinition[]): DecodedProtocolField[] {
  return fields.map((field) => {
    const bytes = payload.slice(field.offset, field.offset + field.length), rawHex = formatHex(bytes);
    if (bytes.length !== field.length) return { field, rawHex, rawValue: null, value: null, display: '越界', error: `字段需要负载偏移 ${field.offset}..${field.offset + field.length - 1}，实际负载仅 ${payload.length} 字节` };
    try {
      let rawValue: number | string, value: number | string;
      if (field.type === 'ascii') { rawValue = new TextDecoder().decode(bytes).replace(/\0+$/, ''); value = rawValue; }
      else if (field.type === 'hex') { rawValue = rawHex; value = rawHex; }
      else if (field.type === 'bcd') { if ([...bytes].some((byte) => (byte >>> 4) > 9 || (byte & 0x0f) > 9)) throw new Error('包含非 BCD 数字'); const digits = [...bytes].map((byte) => `${byte >>> 4}${byte & 0x0f}`).join(''); rawValue = digits; value = digits; }
      else { let numeric = unsigned(bytes, field.endian); if (field.type === 'int' && numeric >= 2 ** (bytes.length * 8 - 1)) numeric -= 2 ** (bytes.length * 8); if (field.type === 'bits') { const shift = field.bitOffset ?? 0, width = field.bitLength ?? Math.min(32, bytes.length * 8 - shift); numeric = Math.floor(numeric / 2 ** shift) % 2 ** width; } rawValue = numeric; value = numeric * field.scale + field.bias; }
      const enumLabel = field.enum?.[String(rawValue)], display = `${enumLabel ?? value}${field.unit ? ` ${field.unit}` : ''}`;
      return { field, rawHex, rawValue, value, display, error: '' };
    } catch (reason) { return { field, rawHex, rawValue: null, value: null, display: '解析错误', error: reason instanceof Error ? reason.message : String(reason) }; }
  });
}
