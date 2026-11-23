import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentRouter } from '../server/router.js';
import { registerSerialSessionRoutes } from './serial-sessions.js';

const sessionId = '22222222-2222-2222-2222-222222222222';
const createSession = () => ({
  id: sessionId, state: 'connected', dtr: false, rts: false, baudRate: 115200, events: [{ id: 1 }, { id: 2 }],
  port: {
    isOpen: true,
    write: (_payload, callback) => callback(),
    drain: callback => callback(),
    set: (_signals, callback) => callback(),
    update: (_config, callback) => callback(),
  },
});

const dispatch = async (router, method, pathname, body = {}) => {
  const res = {};
  const requestUrl = new URL(`http://localhost${pathname}`);
  await router.dispatch({ req: { method, body }, res, pathname: requestUrl.pathname, requestUrl });
  return res;
};

const createRouter = overrides => {
  const sessions = new Map([[sessionId, createSession()]]), calls = { persisted: 0, closed: 0 };
  const router = registerSerialSessionRoutes(new AgentRouter(), {
    jsonResponse: (res, status, value) => { res.status = status; res.value = value; },
    readJsonBody: async req => req.body,
    listSessions: () => [...sessions.values()],
    getSession: id => sessions.get(id),
    createSession: async () => ({ session: createSession(), reused: false }),
    publicSession: (session, after = 0) => ({ id: session.id, state: session.state, events: session.events.filter(event => event.id > after) }),
    decodePayload: data => Buffer.from(data),
    pushEvent: () => undefined,
    persistSessions: async () => { calls.persisted += 1; },
    closeSession: async () => { calls.closed += 1; },
    removeSession: id => sessions.delete(id),
    ...overrides,
  });
  return { router, sessions, calls };
};

test('serial session routes preserve event cursors and close resources before removal', async () => {
  const { router, sessions, calls } = createRouter();
  const current = await dispatch(router, 'GET', `/api/serial/sessions/${sessionId}?after=1`);
  assert.deepEqual(current.value.events, [{ id: 2 }]);
  const sent = await dispatch(router, 'POST', `/api/serial/sessions/${sessionId}/send`, { data: 'PING', encoding: 'text' });
  assert.equal(sent.value.sent, 4);
  const closed = await dispatch(router, 'DELETE', `/api/serial/sessions/${sessionId}`);
  assert.deepEqual(closed.value, { closed: true });
  assert.equal(calls.closed, 1);
  assert.equal(calls.persisted, 1);
  assert.equal(sessions.has(sessionId), false);
});

test('serial session routes retain missing, wrong-method, disconnected, and invalid-baud failures', async () => {
  const { router, sessions } = createRouter();
  assert.equal((await dispatch(router, 'POST', '/api/serial/sessions/00000000-0000-0000-0000-000000000000/send')).status, 404);
  assert.equal((await dispatch(router, 'GET', `/api/serial/sessions/${sessionId}/send`)).status, 405);
  sessions.get(sessionId).state = 'closed';
  assert.equal((await dispatch(router, 'POST', `/api/serial/sessions/${sessionId}/send`, { data: 'PING' })).status, 400);
  sessions.get(sessionId).state = 'connected';
  assert.equal((await dispatch(router, 'POST', `/api/serial/sessions/${sessionId}/config`, { baudRate: 0 })).status, 400);
});
