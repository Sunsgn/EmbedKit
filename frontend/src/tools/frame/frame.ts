import { crc16Modbus, formatHex, parseHexBytes } from '../../utils/embeddedTools';

export type FrameChecksum = 'none' | 'sum8' | 'xor8' | 'crc16-modbus';
export interface FrameTemplate { header: string; commandBytes: 1 | 2; includeLength: boolean; checksum: FrameChecksum }
export interface FrameField { name: string; offset: number; length: number; hex: string }
export interface FrameResult { bytes: Uint8Array; hex: string; command: number; payload: Uint8Array; fields: FrameField[] }

function checksumSize(kind: FrameChecksum) { return kind === 'none' ? 0 : kind === 'crc16-modbus' ? 2 : 1; }
function checksum(bytes: Uint8Array, kind: FrameChecksum) {
  if (kind === 'none') return new Uint8Array();
  if (kind === 'sum8') return Uint8Array.of(Array.from(bytes).reduce((sum, byte) => sum + byte, 0) & 0xff);
  if (kind === 'xor8') return Uint8Array.of(Array.from(bytes).reduce((sum, byte) => sum ^ byte, 0));
  const crc = crc16Modbus(bytes); return Uint8Array.of(crc & 0xff, crc >>> 8);
}
function commandData(command: number, width: 1 | 2) { const limit = width === 1 ? 0xff : 0xffff; if (!Number.isInteger(command) || command < 0 || command > limit) throw new Error(`命令必须是 0 到 ${limit} 的整数`); return width === 1 ? [command] : [command >>> 8, command & 0xff]; }
function field(name: string, offset: number, bytes: Uint8Array): FrameField { return { name, offset, length: bytes.length, hex: formatHex(bytes) }; }

export function buildCustomFrame(template: FrameTemplate, command: number, payloadValue: string): FrameResult {
  const header = parseHexBytes(template.header), payload = parseHexBytes(payloadValue), commandBytes = Uint8Array.from(commandData(command, template.commandBytes));
  if (!header.length) throw new Error('帧头不能为空');
  const bodyLength = commandBytes.length + payload.length;
  if (template.includeLength && bodyLength > 255) throw new Error('单字节长度字段不能表示超过 255 字节的命令与负载');
  const prefix = Uint8Array.from([...header, ...(template.includeLength ? [bodyLength] : []), ...commandBytes, ...payload]);
  const tail = checksum(prefix, template.checksum), bytes = Uint8Array.from([...prefix, ...tail]);
  return describe(bytes, template, command, payload);
}

function describe(bytes: Uint8Array, template: FrameTemplate, command: number, payload: Uint8Array): FrameResult {
  const headerLength = parseHexBytes(template.header).length, lengthSize = template.includeLength ? 1 : 0;
  const commandOffset = headerLength + lengthSize, payloadOffset = commandOffset + template.commandBytes, checkSize = checksumSize(template.checksum);
  const fields = [field('帧头', 0, bytes.slice(0, headerLength))];
  if (lengthSize) fields.push(field('长度', headerLength, bytes.slice(headerLength, headerLength + 1)));
  fields.push(field('命令', commandOffset, bytes.slice(commandOffset, payloadOffset)), field('负载', payloadOffset, payload));
  if (checkSize) fields.push(field('校验', bytes.length - checkSize, bytes.slice(-checkSize)));
  return { bytes, hex: formatHex(bytes), command, payload, fields };
}

export function parseCustomFrame(template: FrameTemplate, value: string): FrameResult {
  const bytes = parseHexBytes(value), header = parseHexBytes(template.header), checkSize = checksumSize(template.checksum);
  const minimum = header.length + (template.includeLength ? 1 : 0) + template.commandBytes + checkSize;
  if (bytes.length < minimum) throw new Error(`帧长度不足：至少需要 ${minimum} 字节，实际 ${bytes.length} 字节`);
  for (let index = 0; index < header.length; index += 1) if (bytes[index] !== header[index]) throw new Error(`帧头错误：字节偏移 ${index} 期望 0x${header[index].toString(16).padStart(2, '0').toUpperCase()}，实际 0x${bytes[index].toString(16).padStart(2, '0').toUpperCase()}`);
  const lengthOffset = header.length, commandOffset = lengthOffset + (template.includeLength ? 1 : 0), payloadOffset = commandOffset + template.commandBytes, payloadEnd = bytes.length - checkSize;
  if (template.includeLength && bytes[lengthOffset] !== payloadEnd - commandOffset) throw new Error(`长度字段错误：字节偏移 ${lengthOffset} 声明 ${bytes[lengthOffset]}，实际 ${payloadEnd - commandOffset}`);
  if (checkSize) { const actual = bytes.slice(payloadEnd), expected = checksum(bytes.slice(0, payloadEnd), template.checksum); if (formatHex(actual) !== formatHex(expected)) throw new Error(`校验错误：字节偏移 ${payloadEnd} 期望 ${formatHex(expected)}，实际 ${formatHex(actual)}`); }
  let command = 0; for (const byte of bytes.slice(commandOffset, payloadOffset)) command = command * 256 + byte;
  return describe(bytes, template, command, bytes.slice(payloadOffset, payloadEnd));
}
