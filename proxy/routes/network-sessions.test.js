import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentRouter } from '../server/router.js';
import { registerNetworkSessionRoutes } from './network-sessions.js';

const sessionId = '33333333-3333-3333-3333-333333333333';
const peer = '127.0.0.1:9000';
const createSession = () => ({
  id: sessionId, type: 'tcp', mode: 'server', state: 'connected', clients: new Map([[peer, { peer }]]),
  peers: new Map([[peer, { txBytes: 0, lastSeenAt: '' }]]), events: [{ id: 1 }, { id: 2 }],
});

const dispatch = async (router, method, pathname, body = {}) => {
  const res = {}, requestUrl = new URL(`http://localhost${pathname}`);
  await router.dispatch({ req: { method, body }, res, pathname: requestUrl.pathname, requestUrl });
  return res;
};

const createRouter = overrides => {
  const sessions = new Map([[sessionId, createSession()]]), calls = { persisted: 0, closed: 0, writes: 0 };
  const router = registerNetworkSessionRoutes(new AgentRouter(), {
    jsonResponse: (res, status, value) => { res.status = status; res.value = value; },
    readJsonBody: async req => req.body,
    status: () => ({ available: true, activeSessions: sessions.size, maxSessions: 8 }),
    listSessions: () => [...sessions.values()],
    getSession: id => sessions.get(id),
    createSession: () => createSession(),
    publicSession: (session, after = 0) => ({ id: session.id, state: session.state, events: session.events.filter(event => event.id > after) }),
    decodePayload: data => Buffer.from(data),
    writeTcp: async () => { calls.writes += 1; },
    sendUdp: async () => undefined,
    pushEvent: session => { session.events.push({ id: 3 }); },
    persistSessions: async () => { calls.persisted += 1; },
    closeSession: () => { calls.closed += 1; },
    removeSession: id => sessions.delete(id),
    ...overrides,
  });
  return { router, sessions, calls };
};

test('network session routes preserve event cursors, peer evidence, and close persistence', async () => {
  const { router, sessions, calls } = createRouter();
  assert.deepEqual((await dispatch(router, 'GET', `/api/network/sessions/${sessionId}?after=1`)).value.events, [{ id: 2 }]);
  const sent = await dispatch(router, 'POST', `/api/network/sessions/${sessionId}/send`, { data: 'PING', encoding: 'text', peer });
  assert.deepEqual(sent.value, { sent: 4, targets: [peer] });
  assert.equal(calls.writes, 1);
  assert.equal(sessions.get(sessionId).peers.get(peer).txBytes, 4);
  assert.equal(sessions.get(sessionId).events.at(-1).peer, peer);
  assert.deepEqual((await dispatch(router, 'DELETE', `/api/network/sessions/${sessionId}`)).value, { closed: true });
  assert.equal(calls.closed, 1);
  assert.equal(calls.persisted, 1);
  assert.equal(sessions.has(sessionId), false);
});

test('network session routes retain missing, wrong-method, disconnected, and stale-peer failures', async () => {
  const { router, sessions } = createRouter();
  assert.equal((await dispatch(router, 'POST', '/api/network/sessions/00000000-0000-0000-0000-000000000000/send')).status, 404);
  assert.equal((await dispatch(router, 'GET', `/api/network/sessions/${sessionId}/send`)).status, 405);
  sessions.get(sessionId).state = 'closed';
  assert.equal((await dispatch(router, 'POST', `/api/network/sessions/${sessionId}/send`, { data: 'PING' })).status, 400);
  sessions.get(sessionId).state = 'connected';
  const stale = await dispatch(router, 'POST', `/api/network/sessions/${sessionId}/send`, { data: 'PING', peer: 'missing:1' });
  assert.equal(stale.status, 400);
  assert.equal(stale.value.error, 'Selected TCP client is no longer connected');
});
