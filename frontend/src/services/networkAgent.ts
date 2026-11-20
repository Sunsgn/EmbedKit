import { agentRequest } from './agentClient';
import { agentPaths } from '../application/agent/routes';
import { connectionSessionManager } from '../application/sessions/connectionSessionManager';

export type NetworkProtocol = 'tcp' | 'udp';
export type NetworkMode = 'client' | 'server';
export type NetworkFrameMode = 'raw' | 'chunk' | 'auto' | 'line' | 'idle';
export interface NetworkAgentEvent { id: number; timestamp: string; direction: 'rx' | 'tx' | 'system'; text: string; hex: string; byteLength: number; peer?: string }
export interface NetworkAgentPeer { id: string; address: string; port: number; connected: boolean; connectedAt: string; lastSeenAt: string; rxBytes: number; txBytes: number }
export interface NetworkAgentSession { id: string; type: NetworkProtocol; mode?: NetworkMode; host: string; port: number; localPort?: number; localAddress: string; state: 'connecting' | 'connected' | 'error' | 'closed'; rxBytes: number; txBytes: number; clientCount?: number; peers?: NetworkAgentPeer[]; droppedEvents?: number; firstEventId?: number; connectTimeoutMs?: number; frameMode?: NetworkFrameMode; frameGapMs?: number; events: NetworkAgentEvent[] }
export interface OpenNetworkOptions { type: NetworkProtocol; mode: NetworkMode; host: string; port: number; localPort?: number; connectTimeoutMs?: number; frameMode?: NetworkFrameMode; frameGapMs?: number }

const networkSnapshot = (session: NetworkAgentSession) => session.id && (session.type === 'tcp' || session.type === 'udp') && session.state && Number.isFinite(session.rxBytes) && Number.isFinite(session.txBytes) ? { id: session.id, transport: session.type, provider: 'local-agent' as const, state: session.state, endpoint: session.localAddress || `${session.host}:${session.port}`, rxBytes: session.rxBytes, txBytes: session.txBytes } : null;
const trackNetworkSession = (session: NetworkAgentSession) => { const snapshot = networkSnapshot(session); if (snapshot) connectionSessionManager.upsert(snapshot); };

export async function getNetworkStatus() { return await agentRequest<{ available: boolean; activeSessions: number; maxSessions: number }>(agentPaths.networkStatus); }
export async function listNetworkSessions() { const sessions = (await agentRequest<{ sessions: NetworkAgentSession[] }>(agentPaths.networkSessions)).sessions; connectionSessionManager.reconcile(['tcp', 'udp'], sessions.map(networkSnapshot).filter((item): item is NonNullable<typeof item> => item !== null)); return sessions; }
export async function openNetworkSession(options: OpenNetworkOptions) { const session = await agentRequest<NetworkAgentSession>(agentPaths.networkSessions, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options) }); trackNetworkSession(session); return session; }
export async function readNetworkSession(id: string, after = 0) { const session = await agentRequest<NetworkAgentSession>(agentPaths.networkSession(id, after)); trackNetworkSession(session); return session; }
export async function closeNetworkSession(id: string) { const known = connectionSessionManager.list().find(item => (item.transport === 'tcp' || item.transport === 'udp') && item.id === id); const result = await agentRequest<{ closed: boolean }>(agentPaths.networkSession(id), { method: 'DELETE' }); if (known) connectionSessionManager.remove(known.transport, id); return result; }
export async function sendNetworkData(id: string, data: string, encoding: 'text' | 'hex', peer?: string) { return await agentRequest<{ sent: number; targets?: string[] }>(agentPaths.networkSend(id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, encoding, peer }) }); }
