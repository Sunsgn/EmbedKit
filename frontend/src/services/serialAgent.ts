import { agentRequest } from './agentClient';

export interface SerialAgentPort { path: string; manufacturer: string; serialNumber: string; vendorId: string; productId: string; pnpId: string; friendlyName: string }
export interface SerialAgentEvent { id: number; timestamp: string; direction: 'rx' | 'tx' | 'system'; text: string; hex: string; byteLength: number }
export type SerialFrameMode = 'auto' | 'line' | 'idle' | 'raw';
export interface SerialAgentSession { id: string; path: string; baudRate: number; dataBits: number; stopBits: number; parity: string; flowControl: string; dtr: boolean; rts: boolean; frameMode?: SerialFrameMode; frameGapMs?: number; state: 'connecting' | 'connected' | 'error' | 'closed'; rxBytes: number; txBytes: number; openedAt: string; events: SerialAgentEvent[]; reused?: boolean }
export interface OpenSerialOptions { path: string; baudRate: number; dataBits?: number; stopBits?: number; parity?: string; flowControl?: string; dtr?: boolean; rts?: boolean; frameMode?: SerialFrameMode; frameGapMs?: number }

export async function listSerialPorts() { return (await agentRequest<{ ports: SerialAgentPort[] }>('/api/serial/ports')).ports; }
export async function listSerialSessions() { return (await agentRequest<{ sessions: SerialAgentSession[] }>('/api/serial/sessions')).sessions; }
export async function openSerialSession(options: OpenSerialOptions) { return await agentRequest<SerialAgentSession>('/api/serial/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options) }); }
export async function readSerialSession(id: string, after = 0) { return await agentRequest<SerialAgentSession>(`/api/serial/sessions/${id}?after=${after}`); }
export async function closeSerialSession(id: string) { return await agentRequest<{ closed: boolean }>(`/api/serial/sessions/${id}`, { method: 'DELETE' }); }
export async function sendSerialData(id: string, data: string, encoding: 'text' | 'hex') { return await agentRequest<{ sent: number }>(`/api/serial/sessions/${id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, encoding }) }); }
export async function setSerialSignals(id: string, dtr: boolean, rts: boolean) { return await agentRequest<{ dtr: boolean; rts: boolean }>('/api/serial/sessions/' + id + '/signals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dtr, rts }) }); }
export async function updateSerialBaudRate(id: string, baudRate: number) { return await agentRequest<{ baudRate: number }>(`/api/serial/sessions/${id}/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baudRate }) }); }
