const sessionPath = /^\/api\/network\/sessions\/([0-9a-f-]+)$/i;
const sendPath = /^\/api\/network\/sessions\/([0-9a-f-]+)\/send$/i;
const anySessionPath = /^\/api\/network\/sessions\/([0-9a-f-]+)(?:\/(send))?$/i;

const findSession = (getSession, jsonResponse, res, id) => {
  const session = getSession(id);
  if (!session) jsonResponse(res, 404, { error: 'Network session not found' });
  return session;
};

export function registerNetworkSessionRoutes(router, dependencies) {
  const { jsonResponse, readJsonBody, status, listSessions, getSession, createSession, publicSession, decodePayload, writeTcp, sendUdp, pushEvent, persistSessions, closeSession, removeSession } = dependencies;

  router.register({ id: 'network.status', method: 'GET', path: '/api/network/status', handler: async ({ res }) => jsonResponse(res, 200, status()) });
  router.register({ id: 'network.sessions-list', method: 'GET', path: '/api/network/sessions', handler: async ({ res }) => jsonResponse(res, 200, { sessions: listSessions().map(session => publicSession(session)) }) });
  router.register({
    id: 'network.sessions', method: 'POST', path: '/api/network/sessions',
    handler: async ({ req, res }) => {
      try { const session = createSession(await readJsonBody(req)); await persistSessions(); jsonResponse(res, 201, publicSession(session)); }
      catch (error) { jsonResponse(res, 400, { error: error.message }); }
    },
  });
  router.register({
    id: 'network.session', method: 'GET', path: sessionPath,
    handler: async ({ res, match, requestUrl }) => {
      const session = findSession(getSession, jsonResponse, res, match[1]);
      if (!session) return;
      const after = Math.max(0, Number(requestUrl.searchParams.get('after') || 0));
      jsonResponse(res, 200, publicSession(session, Number.isFinite(after) ? after : 0));
    },
  });
  router.register({
    id: 'network.session-close', method: 'DELETE', path: sessionPath,
    handler: async ({ res, match }) => {
      const session = findSession(getSession, jsonResponse, res, match[1]);
      if (!session) return;
      closeSession(session); removeSession(session.id); await persistSessions();
      jsonResponse(res, 200, { closed: true });
    },
  });
  router.register({
    id: 'network.send', method: 'POST', path: sendPath,
    handler: async ({ req, res, match }) => {
      const session = findSession(getSession, jsonResponse, res, match[1]);
      if (!session) return;
      try {
        if (session.state !== 'connected') throw new Error('Network session is not connected');
        const body = await readJsonBody(req), payload = decodePayload(body.data, body.encoding);
        let targets = [];
        if (session.type === 'tcp' && session.mode === 'client') {
          await writeTcp(session.socket, payload); targets = [`${session.host}:${session.port}`];
        } else if (session.type === 'tcp') {
          if (!session.clients.size) throw new Error('No TCP client is connected');
          const requestedPeer = String(body.peer || '*');
          const selected = requestedPeer === '*' ? [...session.clients.entries()] : [[requestedPeer, session.clients.get(requestedPeer)]];
          if (selected.some(([, client]) => !client)) throw new Error('Selected TCP client is no longer connected');
          await Promise.all(selected.map(([, client]) => writeTcp(client, payload)));
          targets = selected.map(([peer]) => peer);
          for (const peer of targets) { const evidence = session.peers.get(peer); if (evidence) { evidence.txBytes += payload.length; evidence.lastSeenAt = new Date().toISOString(); } }
        } else if (session.mode === 'client') {
          await sendUdp(session.socket, payload); targets = [`${session.host}:${session.port}`];
        } else {
          if (!session.lastPeer) throw new Error('No UDP peer has sent data yet');
          const requestedPeer = String(body.peer || `${session.lastPeer.address}:${session.lastPeer.port}`), evidence = session.peers.get(requestedPeer);
          if (!evidence) throw new Error('Selected UDP peer is unavailable');
          await sendUdp(session.socket, payload, evidence); targets = [requestedPeer]; evidence.txBytes += payload.length; evidence.lastSeenAt = new Date().toISOString();
        }
        pushEvent(session, 'tx', payload);
        if (session.mode === 'server') session.events[session.events.length - 1].peer = targets.length === 1 ? targets[0] : `${targets.length} peers`;
        jsonResponse(res, 200, { sent: payload.length, targets });
      } catch (error) { jsonResponse(res, 400, { error: error.message }); }
    },
  });
  for (const [id, method] of [['network.session-unsupported-get', 'GET'], ['network.session-unsupported-post', 'POST'], ['network.session-unsupported-delete', 'DELETE']]) {
    router.register({
      id, method, path: anySessionPath,
      handler: async ({ res, match }) => {
        if (!findSession(getSession, jsonResponse, res, match[1])) return;
        jsonResponse(res, 405, { error: 'Unsupported operation for network session' });
      },
    });
  }
  return router;
}
