import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentRouter } from '../server/router.js';
import { registerAiServiceRoutes } from './ai-services.js';

const dispatch = async (router, method, path) => {
  const res = {}, requestUrl = new URL(`http://localhost${path}`);
  const handled = await router.dispatch({ req: { method }, res, pathname: requestUrl.pathname, requestUrl });
  return { handled, ...res };
};

const createRouter = (calls = []) => registerAiServiceRoutes(new AgentRouter(), {
  jsonResponse: (res, status, value) => { res.status = status; res.value = value; },
  detectServers: async () => [{ name: 'Ollama', models: [{ id: 'local-model' }] }],
  proxyRequest: async (_req, res, target) => { calls.push(target); res.status = 204; },
});

test('AI service routes expose detected servers and case-insensitive model lookup', async () => {
  const router = createRouter();
  assert.equal((await dispatch(router, 'GET', '/api/servers')).value.servers[0].name, 'Ollama');
  const models = await dispatch(router, 'GET', '/api/models?server=ollama');
  assert.equal(models.status, 200);
  assert.deepEqual(models.value.models, [{ id: 'local-model' }]);
  assert.equal((await dispatch(router, 'GET', '/api/models?server=missing')).status, 404);
});

test('AI proxy routes forward only the target segment to the existing security boundary', async () => {
  const calls = [], router = createRouter(calls);
  const proxied = await dispatch(router, 'POST', '/proxy/http://localhost:11434/v1/chat/completions');
  assert.equal(proxied.handled, true);
  assert.equal(proxied.status, 204);
  assert.deepEqual(calls, ['http://localhost:11434/v1/chat/completions']);
  assert.equal((await dispatch(router, 'POST', '/proxy/')).handled, false);
});
