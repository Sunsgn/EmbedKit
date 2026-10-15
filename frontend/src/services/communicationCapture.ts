export const COMMUNICATION_CAPTURE_SCHEMA = 'embedkit.communication-capture';
export const COMMUNICATION_CAPTURE_VERSION = 1 as const;
export const COMMUNICATION_CAPTURE_MAX_BYTES = 1024 * 1024;
export const COMMUNICATION_CAPTURE_KEY = 'embedkit.communication-capture.pending';

export type CommunicationTransport = 'serial' | 'tcp' | 'udp' | 'websocket';

export interface CommunicationCaptureRecord {
  timestamp: string;
  hex: string;
  byteLength: number;
  peer?: string;
}

export interface CommunicationCapture {
  schema: typeof COMMUNICATION_CAPTURE_SCHEMA;
  version: typeof COMMUNICATION_CAPTURE_VERSION;
  id: string;
  capturedAt: string;
  transport: CommunicationTransport;
  direction: 'rx';
  sessionId: string;
  endpoint: string;
  byteLength: number;
  truncated: boolean;
  skippedRecords: number;
  records: CommunicationCaptureRecord[];
}

export interface CaptureEventInput {
  timestamp: string;
  direction: 'rx' | 'tx' | 'system';
  hex?: string;
  peer?: string;
}

const transports = new Set<CommunicationTransport>(['serial', 'tcp', 'udp', 'websocket']);
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const clean = (value: string, max: number) => Array.from(value).filter((character) => character.charCodeAt(0) >= 0x20).join('').trim().slice(0, max);

function parseHex(value: string): number[] | null {
  const compact = value.replace(/(?:0x|[\s,;:_-])/gi, '');
  if (!compact || compact.length % 2 || !/^[0-9a-f]+$/i.test(compact)) return null;
  return compact.match(/../g)!.map((part) => Number.parseInt(part, 16));
}

const formatHex = (bytes: number[]) => bytes.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');

export function createCommunicationCapture(input: {
  transport: CommunicationTransport;
  sessionId: string;
  endpoint: string;
  events: CaptureEventInput[];
  maxBytes?: number;
}): CommunicationCapture {
  if (!transports.has(input.transport)) throw new Error('不支持的通信类型');
  const limit = Math.max(1, Math.min(COMMUNICATION_CAPTURE_MAX_BYTES, Math.floor(input.maxBytes ?? COMMUNICATION_CAPTURE_MAX_BYTES)));
  const records: CommunicationCaptureRecord[] = [];
  let byteLength = 0, skippedRecords = 0, truncated = false;
  for (const event of input.events) {
    if (event.direction !== 'rx') continue;
    const bytes = parseHex(event.hex ?? '');
    if (!bytes) { skippedRecords += 1; continue; }
    const remaining = limit - byteLength;
    if (remaining <= 0) { truncated = true; break; }
    const captured = bytes.slice(0, remaining);
    records.push({ timestamp: event.timestamp, hex: formatHex(captured), byteLength: captured.length, ...(event.peer ? { peer: clean(event.peer, 300) } : {}) });
    byteLength += captured.length;
    if (captured.length < bytes.length) { truncated = true; break; }
  }
  if (!byteLength) throw new Error(skippedRecords ? '接收记录没有可解析的 HEX 原始数据' : '当前会话没有 RX 接收数据');
  return {
    schema: COMMUNICATION_CAPTURE_SCHEMA,
    version: COMMUNICATION_CAPTURE_VERSION,
    id: globalThis.crypto?.randomUUID?.() ?? `capture-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    capturedAt: new Date().toISOString(),
    transport: input.transport,
    direction: 'rx',
    sessionId: clean(input.sessionId, 300),
    endpoint: clean(input.endpoint, 500),
    byteLength,
    truncated,
    skippedRecords,
    records,
  };
}

export function normalizeCommunicationCapture(value: unknown): CommunicationCapture | null {
  if (!object(value) || value.schema !== COMMUNICATION_CAPTURE_SCHEMA || value.version !== COMMUNICATION_CAPTURE_VERSION || !transports.has(value.transport as CommunicationTransport) || value.direction !== 'rx' || typeof value.id !== 'string' || typeof value.sessionId !== 'string' || typeof value.endpoint !== 'string' || !Array.isArray(value.records)) return null;
  let byteLength = 0;
  const records: CommunicationCaptureRecord[] = [];
  for (const record of value.records) {
    if (!object(record) || typeof record.timestamp !== 'string' || typeof record.hex !== 'string') return null;
    const bytes = parseHex(record.hex);
    if (!bytes || byteLength + bytes.length > COMMUNICATION_CAPTURE_MAX_BYTES) return null;
    byteLength += bytes.length;
    records.push({ timestamp: record.timestamp, hex: formatHex(bytes), byteLength: bytes.length, ...(typeof record.peer === 'string' ? { peer: clean(record.peer, 300) } : {}) });
  }
  if (!records.length || value.byteLength !== byteLength) return null;
  return { schema: COMMUNICATION_CAPTURE_SCHEMA, version: COMMUNICATION_CAPTURE_VERSION, id: clean(value.id, 300), capturedAt: typeof value.capturedAt === 'string' ? value.capturedAt : new Date(0).toISOString(), transport: value.transport as CommunicationTransport, direction: 'rx', sessionId: clean(value.sessionId, 300), endpoint: clean(value.endpoint, 500), byteLength, truncated: value.truncated === true, skippedRecords: Number.isSafeInteger(value.skippedRecords) && Number(value.skippedRecords) >= 0 ? Number(value.skippedRecords) : 0, records };
}

export function communicationCaptureHex(capture: CommunicationCapture) {
  return capture.records.map((record) => record.hex).join(' ');
}

export function writePendingCommunicationCapture(capture: CommunicationCapture) {
  sessionStorage.setItem(COMMUNICATION_CAPTURE_KEY, JSON.stringify(capture));
}

export function readPendingCommunicationCapture(): CommunicationCapture | null {
  const raw = sessionStorage.getItem(COMMUNICATION_CAPTURE_KEY);
  if (!raw) return null;
  try { return normalizeCommunicationCapture(JSON.parse(raw)); } catch { return null; }
}

export function clearPendingCommunicationCapture(id?: string) {
  if (!id) { sessionStorage.removeItem(COMMUNICATION_CAPTURE_KEY); return; }
  const current = readPendingCommunicationCapture();
  if (!current || current.id === id) sessionStorage.removeItem(COMMUNICATION_CAPTURE_KEY);
}

export function takePendingCommunicationCapture(): CommunicationCapture | null {
  const capture = readPendingCommunicationCapture();
  clearPendingCommunicationCapture(capture?.id);
  return capture;
}
