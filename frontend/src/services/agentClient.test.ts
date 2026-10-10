import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentClientError, agentRequest, getAgentStatus, hasAgentCapability } from './agentClient';

afterEach(() => vi.unstubAllGlobals());
function response(body: unknown, status = 200, protocol = '1') { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'X-EmbedKit-Protocol': protocol } }); }
describe('central Local Agent client', () => {
  it('validates status and capabilities', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ available: true, name: 'EmbedKit Local Agent', version: '1.0.0', protocolVersion: 1, uptimeSeconds: 1, capabilities: ['serial'], serialSessions: 0, networkSessions: 0, buildJobs: 0 }))); const status = await getAgentStatus(); expect(hasAgentCapability(status, 'serial')).toBe(true); expect(hasAgentCapability(status, 'can')).toBe(false); });
  it('classifies offline and incompatible agents', async () => { vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed'))); await expect(getAgentStatus()).rejects.toMatchObject({ kind: 'offline' }); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, 200, '2'))); await expect(getAgentStatus()).rejects.toMatchObject({ kind: 'incompatible' }); });
  it('preserves structured HTTP errors', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: { message: 'Port busy' }, code: 'SERIAL_BUSY' }, 409))); await expect(agentRequest('/api/test')).rejects.toMatchObject({ kind: 'http', status: 409, code: 'SERIAL_BUSY', message: 'Port busy (SERIAL_BUSY)' }); });
  it('rejects invalid status payloads', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ available: true }))); await expect(getAgentStatus()).rejects.toBeInstanceOf(AgentClientError); });
});
