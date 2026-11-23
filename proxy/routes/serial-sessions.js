const sessionPath = /^\/api\/serial\/sessions\/([0-9a-f-]+)$/i;
const actionPath = action => new RegExp(`^/api/serial/sessions/([0-9a-f-]+)/${action}$`, 'i');
const sendPath = actionPath('send');
const signalsPath = actionPath('signals');
const configPath = actionPath('config');
const anySessionPath = /^\/api\/serial\/sessions\/([0-9a-f-]+)(?:\/(send|signals|config))?$/i;

const findSession = (getSession, jsonResponse, res, id) => {
  const session = getSession(id);
  if (!session) jsonResponse(res, 404, { error: 'Serial session not found' });
  return session;
};

const requireConnected = session => {
  if (session.state !== 'connected' || !session.port.isOpen) throw new Error('Serial session is not connected');
};

export function registerSerialSessionRoutes(router, dependencies) {
  const { jsonResponse, readJsonBody, listSessions, getSession, createSession, publicSession, decodePayload, pushEvent, persistSessions, closeSession, removeSession } = dependencies;

  router.register({ id: 'serial.sessions-list', method: 'GET', path: '/api/serial/sessions', handler: async ({ res }) => jsonResponse(res, 200, { sessions: listSessions().map(session => publicSession(session)) }) });
  router.register({
    id: 'serial.sessions', method: 'POST', path: '/api/serial/sessions',
    handler: async ({ req, res }) => {
      try { const { session, reused } = await createSession(await readJsonBody(req)); jsonResponse(res, reused ? 200 : 201, { ...publicSession(session), reused }); }
      catch (error) { jsonResponse(res, 400, { error: error.message }); }
    },
  });
  router.register({
    id: 'serial.session', method: 'GET', path: sessionPath,
    handler: async ({ res, match, requestUrl }) => {
      const session = findSession(getSession, jsonResponse, res, match[1]);
      if (!session) return;
      const after = Math.max(0, Number(requestUrl.searchParams.get('after') || 0));
      jsonResponse(res, 200, publicSession(session, Number.isFinite(after) ? after : 0));
    },
  });
  router.register({
    id: 'serial.session-close', method: 'DELETE', path: sessionPath,
    handler: async ({ res, match }) => {
      const session = findSession(getSession, jsonResponse, res, match[1]);
      if (!session) return;
      await closeSession(session); removeSession(session.id); await persistSessions();
      jsonResponse(res, 200, { closed: true });
    },
  });
  router.register({
    id: 'serial.send', method: 'POST', path: sendPath,
    handler: async ({ req, res, match }) => {
      const session = findSession(getSession, jsonResponse, res, match[1]);
      if (!session) return;
      try {
        requireConnected(session);
        const body = await readJsonBody(req), payload = decodePayload(body.data, body.encoding);
        await new Promise((resolve, reject) => session.port.write(payload, error => error ? reject(error) : session.port.drain(drainError => drainError ? reject(drainError) : resolve())));
        pushEvent(session, 'tx', payload); jsonResponse(res, 200, { sent: payload.length });
      } catch (error) { jsonResponse(res, 400, { error: error.message }); }
    },
  });
  router.register({
    id: 'serial.signals', method: 'POST', path: signalsPath,
    handler: async ({ req, res, match }) => {
      const session = findSession(getSession, jsonResponse, res, match[1]);
      if (!session) return;
      try {
        const body = await readJsonBody(req);
        if (typeof body.dtr === 'boolean') session.dtr = body.dtr;
        if (typeof body.rts === 'boolean') session.rts = body.rts;
        await new Promise((resolve, reject) => session.port.set({ dtr: session.dtr, rts: session.rts }, error => error ? reject(error) : resolve()));
        pushEvent(session, 'system', `控制信号 DTR=${session.dtr ? 'ON' : 'OFF'} RTS=${session.rts ? 'ON' : 'OFF'}`);
        await persistSessions(); jsonResponse(res, 200, { dtr: session.dtr, rts: session.rts });
      } catch (error) { jsonResponse(res, 400, { error: error.message }); }
    },
  });
  router.register({
    id: 'serial.config', method: 'POST', path: configPath,
    handler: async ({ req, res, match }) => {
      const session = findSession(getSession, jsonResponse, res, match[1]);
      if (!session) return;
      try {
        requireConnected(session);
        const body = await readJsonBody(req), baudRate = Number(body.baudRate);
        if (!Number.isInteger(baudRate) || baudRate < 50 || baudRate > 12000000) throw new Error('Invalid serial baud rate');
        await new Promise((resolve, reject) => session.port.update({ baudRate }, error => error ? reject(error) : resolve()));
        session.baudRate = baudRate; pushEvent(session, 'system', `波特率已切换为 ${baudRate}`);
        await persistSessions(); jsonResponse(res, 200, { baudRate });
      } catch (error) { jsonResponse(res, 400, { error: error.message }); }
    },
  });
  for (const [id, method] of [['serial.session-unsupported-get', 'GET'], ['serial.session-unsupported-post', 'POST'], ['serial.session-unsupported-delete', 'DELETE']]) {
    router.register({
      id, method, path: anySessionPath,
      handler: async ({ res, match }) => {
        if (!findSession(getSession, jsonResponse, res, match[1])) return;
        jsonResponse(res, 405, { error: 'Unsupported operation for serial session' });
      },
    });
  }
  return router;
}
