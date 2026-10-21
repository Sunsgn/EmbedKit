import { LOCAL_PROXY_BASE } from './aiService';

export const AGENT_PROTOCOL_VERSION = 1;
export type AgentErrorKind = 'offline' | 'timeout' | 'cancelled' | 'incompatible' | 'http' | 'invalid-response';
export interface AgentStatus { available: boolean; name: string; version: string; protocolVersion: number; uptimeSeconds: number; capabilities: string[]; serialSessions: number; networkSessions: number; buildJobs: number }

export class AgentClientError extends Error {
  readonly kind: AgentErrorKind;
  readonly status?: number;
  readonly code?: string;
  constructor(kind: AgentErrorKind, message: string, status?: number, code?: string) { super(message); this.name = 'AgentClientError'; this.kind = kind; this.status = status; this.code = code; }
}
function errorMessage(value: unknown) { if (!value || typeof value !== 'object') return ''; const result = value as { error?: string | { message?: string }; message?: string }; return typeof result.error === 'string' ? result.error : result.error?.message ?? result.message ?? ''; }

export async function agentRequest<T>(path: string, init: RequestInit = {}, timeoutMs = 5000): Promise<T> {
  const controller = new AbortController(), timer = window.setTimeout(() => controller.abort(), timeoutMs), headers = new Headers(init.headers); headers.set('X-EmbedKit-Protocol', String(AGENT_PROTOCOL_VERSION));
  try {
    let response: Response;
    try { response = await fetch(`${LOCAL_PROXY_BASE}${path}`, { ...init, headers, signal: init.signal ?? controller.signal }); }
    catch (error) { if (error instanceof DOMException && error.name === 'AbortError') { if (init.signal?.aborted) throw new AgentClientError('cancelled', '操作已取消'); throw new AgentClientError('timeout', `本地助手请求超时（${timeoutMs} ms）`); } throw new AgentClientError('offline', '无法连接本地助手，请确认已安装并启动 EmbedKit Local Agent'); }
    const responseProtocol = Number(response.headers.get('X-EmbedKit-Protocol') || 0);
    if (responseProtocol !== AGENT_PROTOCOL_VERSION) throw new AgentClientError('incompatible', `本地助手协议不兼容：网页 ${AGENT_PROTOCOL_VERSION}，Agent ${responseProtocol || '未声明'}`);
    let result: unknown; try { result = await response.json(); } catch { throw new AgentClientError('invalid-response', '本地助手返回了无法解析的响应', response.status); }
    if (!response.ok) { const code = result && typeof result === 'object' ? String((result as { code?: unknown }).code ?? '') || undefined : undefined; throw new AgentClientError('http', `${errorMessage(result) || `本地助手请求失败 (${response.status})`}${code ? ` (${code})` : ''}`, response.status, code); }
    return result as T;
  } finally { window.clearTimeout(timer); }
}

export async function agentBinaryRequest(path: string, init: RequestInit = {}, timeoutMs = 30000) {
  const controller = new AbortController(), timer = window.setTimeout(() => controller.abort(), timeoutMs), headers = new Headers(init.headers); headers.set('X-EmbedKit-Protocol', String(AGENT_PROTOCOL_VERSION));
  try {
    let response: Response;
    try { response = await fetch(`${LOCAL_PROXY_BASE}${path}`, { ...init, headers, signal: init.signal ?? controller.signal }); }
    catch (error) { if (error instanceof DOMException && error.name === 'AbortError') { if (init.signal?.aborted) throw new AgentClientError('cancelled', '操作已取消'); throw new AgentClientError('timeout', `本地助手请求超时（${timeoutMs} ms）`); } throw new AgentClientError('offline', '无法连接本地助手，请确认已安装并启动 EmbedKit Local Agent'); }
    const responseProtocol = Number(response.headers.get('X-EmbedKit-Protocol') || 0);
    if (responseProtocol !== AGENT_PROTOCOL_VERSION) throw new AgentClientError('incompatible', `本地助手协议不兼容：网页 ${AGENT_PROTOCOL_VERSION}，Agent ${responseProtocol || '未声明'}`);
    if (!response.ok) { let result: unknown; try { result = await response.json(); } catch { result = { message: await response.text().catch(() => '') }; } const code = result && typeof result === 'object' ? String((result as { code?: unknown }).code ?? '') || undefined : undefined; throw new AgentClientError('http', `${errorMessage(result) || `本地助手请求失败 (${response.status})`}${code ? ` (${code})` : ''}`, response.status, code); }
    return { bytes: new Uint8Array(await response.arrayBuffer()), contentType: response.headers.get('Content-Type') || '', disposition: response.headers.get('Content-Disposition') || '', sourceUrl: response.headers.get('X-EmbedKit-Source-Url') || '' };
  } finally { window.clearTimeout(timer); }
}

export async function getAgentStatus(timeoutMs = 2000) { const status = await agentRequest<AgentStatus>('/api/agent/status', {}, timeoutMs); if (!status.available || status.protocolVersion !== AGENT_PROTOCOL_VERSION || !Array.isArray(status.capabilities)) throw new AgentClientError('invalid-response', '本地助手状态响应缺少必要字段'); return status; }
export function hasAgentCapability(status: AgentStatus | null | undefined, capability: string) { return status?.capabilities.includes(capability) ?? false; }
