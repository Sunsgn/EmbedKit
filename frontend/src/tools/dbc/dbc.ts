import { parseHexBytes } from '../../utils/embeddedTools';

export interface DbcSignal { name: string; startBit: number; length: number; littleEndian: boolean; signed: boolean; factor: number; offset: number; minimum: number; maximum: number; unit: string; receivers: string[]; values: Record<string, string> }
export interface DbcMessage { id: number; rawId: number; extended: boolean; name: string; dlc: number; transmitter: string; signals: DbcSignal[] }
export interface DbcDatabase { messages: DbcMessage[]; signalCount: number; warnings: string[] }
export interface DecodedSignal { signal: DbcSignal; raw: number; value: number; text?: string; inRange: boolean }
export interface CanLogFrame { line: number; timestamp?: number; channel: string; id: number; extended: boolean; data: Uint8Array; raw: string }
export interface CanLogError { line: number; message: string; raw: string }
export interface CanLogAnalysis { frames: CanLogFrame[]; errors: CanLogError[]; errorCount: number; ignored: number; truncated: boolean }
export interface DecodedCanLogRow { line: number; timestamp?: number; channel: string; id: number; extended: boolean; message: string; signal: string; raw: number; value: number; unit: string; text?: string; inRange: boolean }

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

const parseCanId = (value: string) => {
  const clean = value.trim(); if (!/^(?:0x)?[\da-f]+$/i.test(clean)) throw new Error('CAN ID 格式无效');
  const id = Number.parseInt(clean.replace(/^0x/i, ''), 16); if (!Number.isInteger(id) || id < 0 || id > 0x1fffffff) throw new Error('CAN ID 超出 29 位范围'); return id;
};
const parseLogData = (value: string) => { const data = parseHexBytes(value.replace(/\s+/g, '')); if (data.length > 64) throw new Error('数据超过 64 字节'); return data; };

/** Parses common candump hash/bracket logs and CSV exports while isolating malformed rows. */
export function parseCanLog(source: string): CanLogAnalysis {
  if (source.length > 5 * 1024 * 1024) throw new Error('CAN 日志超过 5 MiB 浏览器解析上限');
  const lines = source.split(/\r?\n/), frames: CanLogFrame[] = [], errors: CanLogError[] = []; let errorCount = 0, ignored = 0, header: Record<string, number> | null = null, truncated = false;
  for (const [offset, original] of lines.entries()) {
    const line = original.trim(), lineNumber = offset + 1; if (!line || line.startsWith('//') || line.startsWith(';')) { ignored += 1; continue; }
    if (frames.length >= 100000) { truncated = true; break; }
    try {
      const columns = line.split(',').map(item => item.trim());
      if (!header && columns.length >= 2 && columns.some(item => /^(?:timestamp|time|channel|interface|can_id|id|data|payload)$/i.test(item))) { header = {}; columns.forEach((item, index) => { header![item.toLowerCase()] = index; }); ignored += 1; continue; }
      let timestamp: number | undefined, channel = '', idText = '', dataText = '';
      if (header) {
        const at = (...names: string[]) => names.map(name => header![name]).find(index => index !== undefined);
        const timeIndex = at('timestamp', 'time'), channelIndex = at('channel', 'interface'), idIndex = at('can_id', 'id'), dataIndex = at('data', 'payload');
        if (idIndex === undefined || dataIndex === undefined) throw new Error('CSV 表头必须包含 ID 与 Data/Payload 列');
        if (timeIndex !== undefined && columns[timeIndex]) { timestamp = Number(columns[timeIndex]); if (!Number.isFinite(timestamp)) throw new Error('时间戳无效'); }
        channel = channelIndex === undefined ? '' : columns[channelIndex] ?? ''; idText = columns[idIndex] ?? ''; dataText = columns[dataIndex] ?? '';
      } else {
        const hash = line.match(/^(?:\(([\d.]+)\)\s+)?(\S+)\s+([\da-f]{3,8})#(?:#([\da-f]))?([\da-f]*)$/i);
        const bracket = line.match(/^(?:\(([\d.]+)\)|([\d.]+))?\s*(\S+)\s+([\da-f]{3,8})\s+\[(\d{1,2})\]\s+(.+)$/i);
        if (hash) { if (hash[1]) timestamp = Number(hash[1]); channel = hash[2]; idText = hash[3]; dataText = hash[5]; }
        else if (bracket) { const declared = Number(bracket[5]); timestamp = bracket[1] || bracket[2] ? Number(bracket[1] || bracket[2]) : undefined; channel = bracket[3]; idText = bracket[4]; dataText = bracket[6]; const actual = dataText.trim().split(/\s+/).filter(Boolean).length; if (actual !== declared) throw new Error(`DLC 声明 ${declared}，实际 ${actual} 字节`); }
        else throw new Error('不支持的日志行格式');
      }
      const id = parseCanId(idText), data = parseLogData(dataText); frames.push({ line: lineNumber, timestamp, channel, id, extended: id > 0x7ff || idText.replace(/^0x/i, '').length > 3, data, raw: original });
    } catch (reason) { errorCount += 1; if (errors.length < 1000) errors.push({ line: lineNumber, message: reason instanceof Error ? reason.message : String(reason), raw: original }); }
  }
  return { frames, errors, errorCount, ignored, truncated };
}

export function filterCanLogFrames(frames: CanLogFrame[], options: { id?: string; startTime?: number; endTime?: number }) {
  const id = options.id?.trim() ? parseCanId(options.id) : undefined;
  return frames.filter(frame => (id === undefined || frame.id === id) && (options.startTime === undefined || (frame.timestamp !== undefined && frame.timestamp >= options.startTime)) && (options.endTime === undefined || (frame.timestamp !== undefined && frame.timestamp <= options.endTime)));
}

export function decodeCanLog(database: DbcDatabase, frames: CanLogFrame[]) {
  const rows: DecodedCanLogRow[] = [], errors: CanLogError[] = []; let unmatched = 0, failed = 0, outOfRange = 0, truncated = false;
  for (const frame of frames) {
    const message = findDbcMessage(database, frame.id, frame.extended) ?? findDbcMessage(database, frame.id);
    if (!message) { unmatched += 1; continue; }
    try {
      const decoded = decodeDbcMessage(message, Array.from(frame.data, byte => byte.toString(16).padStart(2, '0')).join(''));
      for (const item of decoded.signals) { if (rows.length >= 200000) { truncated = true; break; } if (!item.inRange) outOfRange += 1; rows.push({ line: frame.line, timestamp: frame.timestamp, channel: frame.channel, id: frame.id, extended: frame.extended, message: message.name, signal: item.signal.name, raw: item.raw, value: item.value, unit: item.signal.unit, text: item.text, inRange: item.inRange }); }
      if (truncated) break;
    } catch (reason) { failed += 1; if (errors.length < 1000) errors.push({ line: frame.line, message: reason instanceof Error ? reason.message : String(reason), raw: frame.raw }); }
  }
  return { rows, unmatched, failed, outOfRange, errors, truncated };
}
