import { parseHexBytes } from '../../utils/embeddedTools';

export interface DbcSignal { name: string; startBit: number; length: number; littleEndian: boolean; signed: boolean; factor: number; offset: number; minimum: number; maximum: number; unit: string; receivers: string[]; values: Record<string, string> }
export interface DbcMessage { id: number; rawId: number; extended: boolean; name: string; dlc: number; transmitter: string; signals: DbcSignal[] }
export interface DbcDatabase { messages: DbcMessage[]; signalCount: number; warnings: string[] }
export interface DecodedSignal { signal: DbcSignal; raw: number; value: number; text?: string; inRange: boolean }

export function parseDbc(source: string): DbcDatabase {
  if (source.length > 10 * 1024 * 1024) throw new Error('DBC 文件超过 10 MiB 浏览器解析上限');
  const messages: DbcMessage[] = [], warnings: string[] = []; let current: DbcMessage | null = null;
  const values: Array<{ id: number; signal: string; entries: Record<string, string> }> = [];
  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.trim(); if (!line) continue;
    const message = line.match(/^BO_\s+(\d+)\s+([^:]+):\s+(\d+)\s+(\S+)/);
    if (message) { const rawId = Number(message[1]), extended = rawId > 0x1fffffff, id = extended ? rawId & 0x1fffffff : rawId, dlc = Number(message[3]); if (dlc < 0 || dlc > 64) { warnings.push(`第 ${index + 1} 行消息 DLC ${dlc} 无效，已跳过`); current = null; continue; } current = { rawId, id, extended, name: message[2].trim(), dlc, transmitter: message[4], signals: [] }; messages.push(current); continue; }
    const signal = line.match(/^SG_\s+(\w+)(?:\s+[mM]\d*)?\s*:\s*(\d+)\|(\d+)@([01])([+-])\s+\(([-+\d.eE]+),([-+\d.eE]+)\)\s+\[([-+\d.eE]+)\|([-+\d.eE]+)\]\s+"([^"]*)"\s*(.*)$/);
    if (signal && current) { const length = Number(signal[3]); if (length < 1 || length > 53) { warnings.push(`第 ${index + 1} 行信号 ${signal[1]} 位宽超出 1–53，已跳过`); continue; } current.signals.push({ name: signal[1], startBit: Number(signal[2]), length, littleEndian: signal[4] === '1', signed: signal[5] === '-', factor: Number(signal[6]), offset: Number(signal[7]), minimum: Number(signal[8]), maximum: Number(signal[9]), unit: signal[10], receivers: signal[11].split(',').map(item => item.trim()).filter(Boolean), values: {} }); continue; }
    const enumeration = line.match(/^VAL_\s+(\d+)\s+(\w+)\s+(.+);$/);
    if (enumeration) { const entries: Record<string, string> = {}; for (const entry of enumeration[3].matchAll(/(-?\d+)\s+"([^"]*)"/g)) entries[entry[1]] = entry[2]; values.push({ id: Number(enumeration[1]), signal: enumeration[2], entries }); }
  }
  for (const item of values) { const message = messages.find(candidate => candidate.rawId === item.id || candidate.id === item.id), signal = message?.signals.find(candidate => candidate.name === item.signal); if (signal) signal.values = item.entries; else warnings.push(`枚举 ${item.id}.${item.signal} 未找到对应信号`); }
  if (!messages.length) throw new Error('未在 DBC 中找到有效 BO_ 消息定义');
  return { messages, signalCount: messages.reduce((sum, item) => sum + item.signals.length, 0), warnings };
}

function extractRaw(data: Uint8Array, signal: DbcSignal) {
  let raw = 0;
  if (signal.littleEndian) { for (let index = 0; index < signal.length; index += 1) { const bit = signal.startBit + index; if (bit >= data.length * 8) throw new Error(`${signal.name} 超出数据帧范围`); raw += ((data[Math.floor(bit / 8)] >>> (bit % 8)) & 1) * 2 ** index; } }
  else { let bit = signal.startBit; for (let index = 0; index < signal.length; index += 1) { if (bit < 0 || bit >= data.length * 8) throw new Error(`${signal.name} 超出数据帧范围`); raw = raw * 2 + ((data[Math.floor(bit / 8)] >>> (bit % 8)) & 1); bit = bit % 8 === 0 ? bit + 15 : bit - 1; } }
  if (signal.signed && raw >= 2 ** (signal.length - 1)) raw -= 2 ** signal.length;
  return raw;
}
export function decodeDbcMessage(message: DbcMessage, dataValue: string) {
  const data = parseHexBytes(dataValue); if (data.length !== message.dlc) throw new Error(`消息 ${message.name} 需要 ${message.dlc} 字节，实际 ${data.length} 字节`);
  const signals: DecodedSignal[] = message.signals.map(signal => { const raw = extractRaw(data, signal), value = raw * signal.factor + signal.offset; return { signal, raw, value, text: signal.values[String(raw)], inRange: value >= signal.minimum && value <= signal.maximum }; });
  return { message, data, signals };
}
export function findDbcMessage(database: DbcDatabase, id: number, extended?: boolean) { return database.messages.find(item => item.id === id && (extended === undefined || item.extended === extended)) ?? null; }
