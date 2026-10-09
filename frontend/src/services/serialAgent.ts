import { LOCAL_PROXY_BASE } from './aiService';

export interface SerialAgentPort { path: string; manufacturer: string; serialNumber: string; vendorId: string; productId: string; pnpId: string; friendlyName: string }
export interface SerialAgentEvent { id: number; timestamp: string; direction: 'rx' | 'tx' | 'system'; text: string; hex: string; byteLength: number }
export interface SerialAgentSession { id: string; path: string; baudRate: number; dataBits: number; stopBits: number; parity: string; flowControl: string; dtr: boolean; rts: boolean; state: 'connecting' | 'connected' | 'error' | 'closed'; rxBytes: number; txBytes: number; openedAt: string; events: SerialAgentEvent[]; reused?: boolean }
export interface OpenSerialOptions { path: string; baudRate: number; dataBits?: number; stopBits?: number; parity?: string; flowControl?: string; dtr?: boolean; rts?: boolean }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers); headers.set('X-EmbedKit-Protocol', '1');
  const response = await fetch(`${LOCAL_PROXY_BASE}${path}`, { ...init, headers });
  const result = await response.json() as T & { error?: string | { message?: string }; message?: string; code?: string };
  if (!response.ok) { const message = typeof result.error === 'string' ? result.error : result.error?.message ?? result.message; throw new Error(message ? `${message}${result.code ? ` (${result.code})` : ''}` : `Local Agent 请求失败 (${response.status})`); }
  const protocol = Number(response.headers.get('X-EmbedKit-Protocol') || 1); if (protocol !== 1) throw new Error(`Local Agent 协议不兼容：前端 1，Agent ${protocol}`);
  return result;
}

export async function listSerialPorts() { return (await request<{ ports: SerialAgentPort[] }>('/api/serial/ports')).ports; }
export async function listSerialSessions() { return (await request<{ sessions: SerialAgentSession[] }>('/api/serial/sessions')).sessions; }
export async function openSerialSession(options: OpenSerialOptions) { return await request<SerialAgentSession>('/api/serial/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options) }); }
export async function readSerialSession(id: string, after = 0) { return await request<SerialAgentSession>(`/api/serial/sessions/${id}?after=${after}`); }
export async function closeSerialSession(id: string) { return await request<{ closed: boolean }>(`/api/serial/sessions/${id}`, { method: 'DELETE' }); }
export async function sendSerialData(id: string, data: string, encoding: 'text' | 'hex') { return await request<{ sent: number }>(`/api/serial/sessions/${id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, encoding }) }); }
export async function setSerialSignals(id: string, dtr: boolean, rts: boolean) { return await request<{ dtr: boolean; rts: boolean }>(`/api/serial/sessions/${id}/signals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dtr, rts }) }); }
export async function updateSerialBaudRate(id: string, baudRate: number) { return await request<{ baudRate: number }>(`/api/serial/sessions/${id}/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baudRate }) }); }
