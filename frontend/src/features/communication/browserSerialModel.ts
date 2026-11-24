import { formatHex, parseHexBytes } from '../../utils/embeddedTools';

export const BROWSER_SERIAL_SETTINGS_KEY = 'embedkit.serial.settings';

export interface BrowserSerialPortInfo { usbVendorId?: number; usbProductId?: number; bluetoothServiceClassId?: string }
export interface BrowserSerialPortLike {
  name?: string;
  path?: string;
  getInfo(): BrowserSerialPortInfo;
  open(options: unknown): Promise<void>;
  close(): Promise<void>;
}
export interface BrowserSerialEntryLike { direction: 'rx' | 'tx' | 'system'; text: string; bytes?: number[] }
export interface BrowserSerialSessionLike<T extends BrowserSerialEntryLike = BrowserSerialEntryLike> { entries: T[] }
export interface BrowserSerialRuntimeBuffer { timer: number | null; buffer: number[] }

export function loadBrowserSerialSettings(storage: Pick<Storage, 'getItem'> = localStorage) {
  try {
    const value = JSON.parse(storage.getItem(BROWSER_SERIAL_SETTINGS_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, string | boolean> : {};
  } catch { return {}; }
}

export function saveBrowserSerialSettings(value: Record<string, string | boolean | number>, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(BROWSER_SERIAL_SETTINGS_KEY, JSON.stringify({ ...value, version: 3 }));
}

export function formatBrowserSerialTime(value = new Date()) {
  return `${value.toLocaleTimeString('zh-CN', { hour12: false })}.${String(value.getMilliseconds()).padStart(3, '0')}`;
}

export function filterBrowserSerialEntries<T extends BrowserSerialEntryLike>(session: BrowserSerialSessionLike<T> | null, filter: string, rxHex: boolean, showRx: boolean, showTx: boolean): T[] {
  const query = filter.toLowerCase().trim();
  return session?.entries.filter(entry => (entry.direction === 'system' || entry.direction === 'rx' && showRx || entry.direction === 'tx' && showTx)
    && (!query || (rxHex && entry.bytes ? formatHex(entry.bytes) : entry.text).toLowerCase().includes(query) || entry.direction.includes(query))) ?? [];
}

export function parseBrowserSerialHex(value: string) {
  try { return parseHexBytes(value); }
  catch { throw new Error('HEX 必须是完整字节，例如 DE AD BE EF'); }
}

export function unescapeBrowserSerialText(value: string) {
  return value.replace(/\\u([\da-f]{4})|\\x([\da-f]{2})|\\([rnt0\\])/gi, (_, unicode: string, byte: string, simple: string) => unicode ? String.fromCharCode(Number.parseInt(unicode, 16)) : byte ? String.fromCharCode(Number.parseInt(byte, 16)) : ({ r: '\r', n: '\n', t: '\t', '0': '\0', '\\': '\\' }[simple] ?? simple));
}

export function browserSerialPortName(port: Pick<BrowserSerialPortLike, 'name' | 'path' | 'getInfo'>, index: number) {
  const info = port.getInfo(), detected = [port.name, port.path].map(value => value?.match(/COM\d+/i)?.[0].toUpperCase()).find(Boolean);
  const vendorId = info.usbVendorId?.toString(16).padStart(4, '0').toUpperCase(), productId = info.usbProductId?.toString(16).padStart(4, '0').toUpperCase(), label = detected ?? `串口 ${index}`;
  return vendorId || productId ? `${label} · VID:${vendorId ?? '----'} PID:${productId ?? '----'}` : label;
}

export function drainBrowserSerialBuffer(runtime: BrowserSerialRuntimeBuffer) {
  if (runtime.timer !== null) clearTimeout(runtime.timer);
  const buffered = runtime.buffer; runtime.timer = null; runtime.buffer = []; return buffered;
}

export function isTransientBrowserSerialOpenError(reason: unknown) {
  const name = reason instanceof DOMException ? reason.name : '', message = reason instanceof Error ? reason.message : String(reason);
  return name === 'NetworkError' || /failed to open serial port|serial port.*temporarily unavailable/i.test(message);
}

export function isBrowserSerialChooserCancellation(reason: unknown) {
  const name = reason instanceof DOMException ? reason.name : '', message = reason instanceof Error ? reason.message : String(reason);
  return name === 'NotFoundError' || name === 'AbortError' || /cancel|no port selected/i.test(message);
}

export function isRecoverableBrowserSerialReadError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason);
  return /break received|framing error|parity error|buffer overrun|overrun error/i.test(message);
}

export async function openBrowserSerialPort(port: Pick<BrowserSerialPortLike, 'open' | 'close'>, options: unknown, retryDelayMs = 150) {
  try { await port.open(options); return false; }
  catch (reason) {
    if (!isTransientBrowserSerialOpenError(reason)) throw reason;
    try { await port.close(); } catch { /* An incomplete first open may not need closing. */ }
    await new Promise<void>(resolve => window.setTimeout(resolve, retryDelayMs));
    await port.open(options);
    return true;
  }
}
