import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentRouter } from './router.js';

test('router accepts only shared versioned Agent routes', () => {
  const router = new AgentRouter().register({ id: 'agent.status', method: 'GET', path: '/api/agent/status', handler: async () => undefined });
  assert.deepEqual(router.registeredIds(), ['agent.status']);
  assert.throws(() => router.register({ id: 'unknown.route', method: 'GET', path: '/api/unknown', handler: async () => undefined }), /not declared/);
});

test('router dispatches one matching handler and leaves unknown routes for safe fallback', async () => {
  let calls = 0;
  const router = new AgentRouter().register({ id: 'agent.status', method: 'GET', path: '/api/agent/status', handler: async () => { calls += 1; } });
  assert.equal(await router.dispatch({ req: { method: 'GET' }, pathname: '/api/agent/status' }), true);
  assert.equal(await router.dispatch({ req: { method: 'POST' }, pathname: '/api/agent/status' }), false);
  assert.equal(calls, 1);
});
