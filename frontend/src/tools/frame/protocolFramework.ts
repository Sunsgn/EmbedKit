export type ProtocolFamily = 'modbus-rtu' | 'modbus-tcp' | 'canopen' | 'j1939' | 'uds' | 'lin' | 'at-command' | 'custom-binary';
export type ProtocolTransport = 'uart' | 'rs232' | 'rs485' | 'tcp' | 'udp' | 'can' | 'lin' | 'i2c' | 'spi' | 'usb' | 'ble';
export type ProtocolInteraction = 'request-response' | 'master-slave' | 'publish-subscribe' | 'periodic-report' | 'event-report';
export type ProtocolMessageDirection = 'request' | 'response' | 'report' | 'bidirectional' | 'unknown';
export type ProtocolSegmentRole = 'header' | 'address' | 'length' | 'sequence' | 'command' | 'payload' | 'checksum' | 'tail' | 'other';

export interface ProtocolFrameworkSource { line: number; text: string; location?: string }
export interface ProtocolFrameSegment { id: string; name: string; role: ProtocolSegmentRole; offset: number | null; length: number | null; source: ProtocolFrameworkSource }
export interface ProtocolMessage { id: string; name: string; command: number | null; direction: ProtocolMessageDirection; responseTo: string | null; source: ProtocolFrameworkSource }
export interface ProtocolFramework {
  families: ProtocolFamily[];
  transports: ProtocolTransport[];
  interactions: ProtocolInteraction[];
  frameSegments: ProtocolFrameSegment[];
  messages: ProtocolMessage[];
  unknowns: string[];
  confidence: number;
}

const families = new Set<ProtocolFamily>(['modbus-rtu', 'modbus-tcp', 'canopen', 'j1939', 'uds', 'lin', 'at-command', 'custom-binary']);
const transports = new Set<ProtocolTransport>(['uart', 'rs232', 'rs485', 'tcp', 'udp', 'can', 'lin', 'i2c', 'spi', 'usb', 'ble']);
const interactions = new Set<ProtocolInteraction>(['request-response', 'master-slave', 'publish-subscribe', 'periodic-report', 'event-report']);
const directions = new Set<ProtocolMessageDirection>(['request', 'response', 'report', 'bidirectional', 'unknown']);
const roles = new Set<ProtocolSegmentRole>(['header', 'address', 'length', 'sequence', 'command', 'payload', 'checksum', 'tail', 'other']);
const clean = (value: string, max = 300) => Array.from(value).filter(character => character.charCodeAt(0) >= 0x20).join('').trim().slice(0, max);
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function csvCells(line: string) {
  const result: string[] = []; let value = '', quoted = false;
  for (let index = 0; index < line.length; index += 1) { const character = line[index]; if (character === '"') { if (quoted && line[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted; } else if (character === ',' && !quoted) { result.push(value.trim()); value = ''; } else value += character; }
  result.push(value.trim()); return result;
}

function cells(line: string) {
  if (line.includes('\t')) return line.split('\t').map(value => value.trim());
  if (line.includes('|')) return line.replace(/^\s*\||\|\s*$/g, '').split('|').map(value => value.trim());
  return line.includes(',') ? csvCells(line) : [];
}

function numeric(value: string) {
  const match = value.match(/(?:0x[\da-f]+|\b\d+\b)/i); if (!match) return null;
  const parsed = /^0x/i.test(match[0]) ? Number.parseInt(match[0], 16) : Number(match[0]);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 0xffffffff ? parsed : null;
}

function direction(value: string): ProtocolMessageDirection {
  if (/双向|both|bidirectional/i.test(value)) return 'bidirectional';
  if (/响应|应答|回复|response|reply/i.test(value)) return 'response';
  if (/请求|查询|设置|控制|request|write|read/i.test(value)) return 'request';
  if (/上报|通知|事件|report|notify|event/i.test(value)) return 'report';
  return 'unknown';
}

function role(value: string): ProtocolSegmentRole {
  if (/帧头|包头|同步|起始|header|sync|sof/i.test(value)) return 'header';
  if (/地址|设备号|从机号|address|slave|node\s*id/i.test(value)) return 'address';
  if (/长度|length|len/i.test(value)) return 'length';
  if (/序号|流水|sequence|seq/i.test(value)) return 'sequence';
  if (/命令|指令|功能码|command|cmd|opcode|function/i.test(value)) return 'command';
  if (/数据|负载|参数|data|payload/i.test(value)) return 'payload';
  if (/校验|checksum|crc|bcc|lrc/i.test(value)) return 'checksum';
  if (/帧尾|包尾|结束|tail|eof|terminator/i.test(value)) return 'tail';
  return 'other';
}

function sourceOf(line: number, text: string, location: string): ProtocolFrameworkSource { return { line, text: clean(text, 1000), ...(location ? { location } : {}) }; }
function unique<T>(values: T[]) { return [...new Set(values)]; }

export function emptyProtocolFramework(): ProtocolFramework { return { families: [], transports: [], interactions: [], frameSegments: [], messages: [], unknowns: ['未识别协议族', '未识别传输方式', '未识别交互模式', '未识别帧布局', '未识别命令/消息目录'], confidence: 0 }; }

export function normalizeProtocolFramework(value: unknown): ProtocolFramework | null {
  if (value === undefined) return emptyProtocolFramework();
  if (!object(value) || !Array.isArray(value.families) || !Array.isArray(value.transports) || !Array.isArray(value.interactions) || !Array.isArray(value.frameSegments) || !Array.isArray(value.messages) || !Array.isArray(value.unknowns)) return null;
  if (value.families.length > 8 || value.transports.length > 16 || value.interactions.length > 8 || value.frameSegments.length > 64 || value.messages.length > 256 || value.unknowns.length > 20) return null;
  const normalizedFamilies = value.families.filter((item): item is ProtocolFamily => families.has(item as ProtocolFamily));
  const normalizedTransports = value.transports.filter((item): item is ProtocolTransport => transports.has(item as ProtocolTransport));
  const normalizedInteractions = value.interactions.filter((item): item is ProtocolInteraction => interactions.has(item as ProtocolInteraction));
  if (normalizedFamilies.length !== value.families.length || normalizedTransports.length !== value.transports.length || normalizedInteractions.length !== value.interactions.length) return null;
  const frameSegments = value.frameSegments.map((item, index): ProtocolFrameSegment | null => { if (!object(item) || typeof item.name !== 'string' || !roles.has(item.role as ProtocolSegmentRole) || !object(item.source) || !Number.isSafeInteger(item.source.line) || Number(item.source.line) < 1 || typeof item.source.text !== 'string') return null; if (item.offset !== null && (!Number.isSafeInteger(item.offset) || Number(item.offset) < 0 || Number(item.offset) > 65535)) return null; if (item.length !== null && (!Number.isSafeInteger(item.length) || Number(item.length) < 1 || Number(item.length) > 65535)) return null; return { id: clean(String(item.id || `segment-${index + 1}`), 100), name: clean(item.name), role: item.role as ProtocolSegmentRole, offset: item.offset === null ? null : Number(item.offset), length: item.length === null ? null : Number(item.length), source: { line: Number(item.source.line), text: clean(item.source.text, 1000), ...(typeof item.source.location === 'string' ? { location: clean(item.source.location) } : {}) } }; });
  const messages = value.messages.map((item, index): ProtocolMessage | null => { if (!object(item) || typeof item.name !== 'string' || !directions.has(item.direction as ProtocolMessageDirection) || !object(item.source) || !Number.isSafeInteger(item.source.line) || Number(item.source.line) < 1 || typeof item.source.text !== 'string') return null; if (item.command !== null && (!Number.isSafeInteger(item.command) || Number(item.command) < 0 || Number(item.command) > 0xffffffff)) return null; return { id: clean(String(item.id || `message-${index + 1}`), 100), name: clean(item.name), command: item.command === null ? null : Number(item.command), direction: item.direction as ProtocolMessageDirection, responseTo: typeof item.responseTo === 'string' ? clean(item.responseTo, 100) || null : null, source: { line: Number(item.source.line), text: clean(item.source.text, 1000), ...(typeof item.source.location === 'string' ? { location: clean(item.source.location) } : {}) } }; });
  if (frameSegments.some(item => !item) || messages.some(item => !item)) return null;
  const ids = [...frameSegments, ...messages].map(item => item!.id); if (new Set(ids).size !== ids.length) return null;
  return { families: normalizedFamilies, transports: normalizedTransports, interactions: normalizedInteractions, frameSegments: frameSegments as ProtocolFrameSegment[], messages: messages as ProtocolMessage[], unknowns: value.unknowns.filter(item => typeof item === 'string').map(item => clean(item, 300)), confidence: typeof value.confidence === 'number' && Number.isFinite(value.confidence) ? Math.max(0, Math.min(1, value.confidence)) : 0 };
}

export function extractProtocolFramework(source: string): ProtocolFramework {
  const rows: Array<{ line: number; raw: string; location: string; cells: string[] }> = [], textLines: Array<{ line: number; raw: string; location: string }> = [];
  let location = '';
  source.replace(/\r/g, '').split('\n').forEach((raw, index) => { const line = raw.trim(), marker = line.match(/^\[\[来源:(.+)\]\]$/); if (marker) { location = clean(marker[1]); return; } if (!line) return; textLines.push({ line: index + 1, raw, location }); const values = cells(raw); if (values.length > 1 && !values.every(value => /^:?-{2,}:?$/.test(value))) rows.push({ line: index + 1, raw, location, cells: values }); });
  const whole = textLines.map(item => item.raw).join('\n');
  const detectedFamilies: ProtocolFamily[] = [];
  if (/modbus\s*rtu/i.test(whole)) detectedFamilies.push('modbus-rtu');
  if (/modbus\s*tcp/i.test(whole)) detectedFamilies.push('modbus-tcp');
  if (/canopen/i.test(whole)) detectedFamilies.push('canopen');
  if (/\bj1939\b/i.test(whole)) detectedFamilies.push('j1939');
  if (/\b(?:uds|iso\s*14229)\b/i.test(whole)) detectedFamilies.push('uds');
  if (/\blin\s*(?:bus|总线|协议)\b/i.test(whole)) detectedFamilies.push('lin');
  if (/\bAT\s*(?:command|命令|指令)|AT\+[A-Z]/i.test(whole)) detectedFamilies.push('at-command');
  const detectedTransports: ProtocolTransport[] = [];
  const transportRules: Array<[ProtocolTransport, RegExp]> = [['uart', /\bUART\b|串口/i], ['rs232', /RS[- ]?232/i], ['rs485', /RS[- ]?485/i], ['tcp', /\bTCP\b/i], ['udp', /\bUDP\b/i], ['can', /\bCAN(?:\s*FD)?\b|CAN总线/i], ['lin', /\bLIN\b/i], ['i2c', /I[²2]C/i], ['spi', /\bSPI\b/i], ['usb', /\bUSB\b/i], ['ble', /\bBLE\b|低功耗蓝牙/i]];
  for (const [kind, pattern] of transportRules) if (pattern.test(whole)) detectedTransports.push(kind);
  const detectedInteractions: ProtocolInteraction[] = [];
  if (/请求.{0,12}(?:响应|应答)|request.{0,20}response/i.test(whole)) detectedInteractions.push('request-response');
  if (/主从|主机.{0,12}从机|master.{0,20}slave/i.test(whole)) detectedInteractions.push('master-slave');
  if (/发布.{0,12}订阅|publish.{0,20}subscribe/i.test(whole)) detectedInteractions.push('publish-subscribe');
  if (/周期.{0,12}上报|定时.{0,12}上报|periodic.{0,20}report/i.test(whole)) detectedInteractions.push('periodic-report');
  if (/主动上报|事件上报|异步通知|event.{0,20}(?:report|notify)/i.test(whole)) detectedInteractions.push('event-report');

  const frameSegments: ProtocolFrameSegment[] = [], messages: ProtocolMessage[] = [];
  let segmentColumns: { name: number; offset?: number; length?: number } | null = null, messageColumns: { code: number; name: number; direction?: number } | null = null;
  for (const row of rows) {
    const segmentName = row.cells.findIndex(value => /^(字段|帧字段|组成|名称|field|segment)$/i.test(value)), offset = row.cells.findIndex(value => /^(偏移|字节偏移|offset|位置)$/i.test(value)), length = row.cells.findIndex(value => /^(长度|字节数|length|size|bytes?)$/i.test(value)), payloadSpecific = row.cells.some(value => /^(类型|数据类型|字节序|端序|倍率|比例|偏置|单位|枚举|type|endian|scale|unit|enum)$/i.test(value));
    const code = row.cells.findIndex(value => /^(命令码|指令码|功能码|命令|指令|cmd|command(?:\s*code)?|opcode)$/i.test(value)), messageName = row.cells.findIndex(value => /^(命令名称|指令名称|功能名称|消息名称|名称|name|description|说明)$/i.test(value)), messageDirection = row.cells.findIndex(value => /^(方向|类型|消息类型|direction)$/i.test(value));
    if (segmentName >= 0 && (offset >= 0 || length >= 0) && !payloadSpecific) { segmentColumns = { name: segmentName, ...(offset >= 0 ? { offset } : {}), ...(length >= 0 ? { length } : {}) }; messageColumns = null; continue; }
    if (payloadSpecific) { segmentColumns = null; messageColumns = null; continue; }
    if (code >= 0 && messageName >= 0) { messageColumns = { code, name: messageName, ...(messageDirection >= 0 ? { direction: messageDirection } : {}) }; segmentColumns = null; continue; }
    if (segmentColumns && frameSegments.length < 64) { const name = clean(row.cells[segmentColumns.name] ?? ''); if (name) frameSegments.push({ id: `segment-${frameSegments.length + 1}`, name, role: role(name), offset: segmentColumns.offset === undefined ? null : numeric(row.cells[segmentColumns.offset] ?? ''), length: segmentColumns.length === undefined ? null : numeric(row.cells[segmentColumns.length] ?? ''), source: sourceOf(row.line, row.raw, row.location) }); }
    if (messageColumns && messages.length < 256) { const name = clean(row.cells[messageColumns.name] ?? ''), command = numeric(row.cells[messageColumns.code] ?? ''); if (name && command !== null) messages.push({ id: `message-${messages.length + 1}`, name, command, direction: direction(`${row.cells[messageColumns.direction ?? -1] ?? ''} ${name}`), responseTo: null, source: sourceOf(row.line, row.raw, row.location) }); }
  }
  if (!frameSegments.length) for (const item of textLines) { const match = item.raw.match(/(?:帧格式|报文格式|frame\s*format)\s*[:：=]\s*(.+)/i); if (!match) continue; const parts = match[1].split(/\s*(?:\+|→|->|,|，|\||\/)+\s*/).map(value => clean(value)).filter(Boolean); for (const name of parts.slice(0, 64)) frameSegments.push({ id: `segment-${frameSegments.length + 1}`, name, role: role(name), offset: null, length: null, source: sourceOf(item.line, item.raw, item.location) }); }
  if (!messages.length) for (const item of textLines) { const match = item.raw.match(/(?:命令|指令|功能)(?:码)?\s*[:：=]?\s*(0x[\da-f]+|\d+)\s*[-—:：]?\s*(.{1,100})$/i); if (!match || messages.length >= 256) continue; const name = clean(match[2]); messages.push({ id: `message-${messages.length + 1}`, name, command: numeric(match[1]), direction: direction(name), responseTo: null, source: sourceOf(item.line, item.raw, item.location) }); }
  if (!detectedFamilies.length && frameSegments.some(item => item.role === 'header') && frameSegments.some(item => item.role === 'command')) detectedFamilies.push('custom-binary');
  const result = { families: unique(detectedFamilies), transports: unique(detectedTransports), interactions: unique(detectedInteractions), frameSegments, messages };
  const unknowns = [...(!result.families.length ? ['未识别协议族'] : []), ...(!result.transports.length ? ['未识别传输方式'] : []), ...(!result.interactions.length ? ['未识别交互模式'] : []), ...(!result.frameSegments.length ? ['未识别帧布局'] : []), ...(!result.messages.length ? ['未识别命令/消息目录'] : [])];
  const recognized = 5 - unknowns.length;
  return { ...result, unknowns, confidence: recognized / 5 };
}
