import { agentRequest } from './agentClient';

export type NetworkProtocol = 'tcp' | 'udp';
export type NetworkMode = 'client' | 'server';
export interface NetworkAgentEvent { id: number; timestamp: string; direction: 'rx' | 'tx' | 'system'; text: string; hex: string; byteLength: number; peer?: string }
export interface NetworkAgentSession { id: string; type: NetworkProtocol; mode?: NetworkMode; host: string; port: number; localAddress: string; state: 'connecting' | 'connected' | 'error' | 'closed'; rxBytes: number; txBytes: number; clientCount?: number; events: NetworkAgentEvent[] }
export interface OpenNetworkOptions { type: NetworkProtocol; mode: NetworkMode; host: string; port: number; localPort?: number }

export async function getNetworkStatus() { return await agentRequest<{ available: boolean; activeSessions: number; maxSessions: number }>('/api/network/status'); }
export async function listNetworkSessions() { return (await agentRequest<{ sessions: NetworkAgentSession[] }>('/api/network/sessions')).sessions; }
export async function openNetworkSession(options: OpenNetworkOptions) { return await agentRequest<NetworkAgentSession>('/api/network/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options) }); }
export async function readNetworkSession(id: string, after = 0) { return await agentRequest<NetworkAgentSession>(`/api/network/sessions/${id}?after=${after}`); }
export async function closeNetworkSession(id: string) { return await agentRequest<{ closed: boolean }>(`/api/network/sessions/${id}`, { method: 'DELETE' }); }
export async function sendNetworkData(id: string, data: string, encoding: 'text' | 'hex') { return await agentRequest<{ sent: number }>(`/api/network/sessions/${id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, encoding }) }); }
