import { formatHex } from '../../utils/embeddedTools';
import type { RawTerminalEvent } from './terminalFormat';
import { terminalRxBytes } from './terminalFormat';

export interface BrowserSerialExportEntry {
  timestamp: string;
  direction: 'rx' | 'tx' | 'system';
  text: string;
  bytes?: number[];
}

export interface BrowserSerialExportSession {
  name: string;
  entries: BrowserSerialExportEntry[];
}

const csvCell = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`;

export function createBrowserSerialTextLog(session: BrowserSerialExportSession, displayHex: boolean) {
  return session.entries.map(entry => `[${entry.timestamp}] [${session.name}] [${entry.direction.toUpperCase()}] ${entry.bytes && displayHex ? formatHex(entry.bytes) : entry.text}`).join('\n');
}

export function createBrowserSerialCsvLog(session: BrowserSerialExportSession) {
  return ['timestamp,port,direction,length,data', ...session.entries.map(entry => [csvCell(entry.timestamp), csvCell(session.name), entry.direction, entry.bytes?.length ?? new TextEncoder().encode(entry.text).length, csvCell(entry.bytes ? formatHex(entry.bytes) : entry.text)].join(','))].join('\n');
}

export function createBrowserSerialRawRx(events: RawTerminalEvent[]) {
  return terminalRxBytes(events);
}
