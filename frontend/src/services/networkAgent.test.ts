import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  closeNetworkSession,
  getNetworkStatus,
  listNetworkSessions,
  openNetworkSession,
  readNetworkSession,
  sendNetworkData,
} from './networkAgent';

afterEach(() => vi.unstubAllGlobals());

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-EmbedKit-Protocol': '1' },
  });
}

describe('network Local Agent service', () => {
  it('queries status, restores sessions, and reads incremental events', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ available: true, activeSessions: 1, maxSessions: 16 }))
      .mockResolvedValueOnce(response({ sessions: [{ id: 'net-1' }] }))
      .mockResolvedValueOnce(response({ id: 'net-1', events: [] }));
    vi.stubGlobal('fetch', fetch);

    await expect(getNetworkStatus()).resolves.toMatchObject({ available: true, activeSessions: 1 });
    await expect(listNetworkSessions()).resolves.toEqual([{ id: 'net-1' }]);
    await readNetworkSession('net-1', 17);

    expect(fetch.mock.calls.map(call => new URL(String(call[0])).pathname + new URL(String(call[0])).search)).toEqual([
      '/api/network/status',
      '/api/network/sessions',
      '/api/network/sessions/net-1?after=17',
    ]);
  });

  it('opens, sends, and closes a network session with the expected payloads', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ id: 'net-2', events: [] }))
      .mockResolvedValueOnce(response({ sent: 4 }))
      .mockResolvedValueOnce(response({ closed: true }));
    vi.stubGlobal('fetch', fetch);

    await openNetworkSession({
      type: 'tcp',
      mode: 'client',
      host: '192.168.1.20',
      port: 9000,
      localPort: 0,
    });
    await sendNetworkData('net-2', 'PING', 'text');
    await closeNetworkSession('net-2');

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/api\/network\/sessions$/),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ type: 'tcp', mode: 'client', host: '192.168.1.20', port: 9000, localPort: 0 }) }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/\/api\/network\/sessions\/net-2\/send$/),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ data: 'PING', encoding: 'text' }) }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      expect.stringMatching(/\/api\/network\/sessions\/net-2$/),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
