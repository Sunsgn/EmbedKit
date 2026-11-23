import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentRouter } from '../server/router.js';
import { registerPartRoutes } from './parts.js';

const dispatch = async (router, method, path) => {
  const res = {}, requestUrl = new URL(`http://localhost${path}`);
  await router.dispatch({ req: { method }, res, pathname: requestUrl.pathname, requestUrl });
  return res;
};

const createRouter = calls => registerPartRoutes(new AgentRouter(), {
  jsonResponse: (res, status, value) => { res.status = status; res.value = value; },
  discoverDocuments: async () => ({ documents: [] }),
  readDocument: async () => ({ finalUrl: 'https://example.invalid/test.pdf', bytes: Buffer.alloc(0) }),
  readPartDetails: async part => { calls.push(part); return { part }; },
  maxDocumentResults: 8,
});

test('part detail routes keep current and legacy query contracts', async () => {
  const calls = [], router = createRouter(calls);
  assert.deepEqual((await dispatch(router, 'GET', '/api/component-details?part=STM32F4')).value, { part: 'STM32F4' });
  assert.deepEqual((await dispatch(router, 'GET', '/api/chip-details?chip=ESP32')).value, { part: 'ESP32' });
  assert.deepEqual(calls, ['STM32F4', 'ESP32']);
});

test('legacy part detail compatibility preserves methods and missing-query errors', async () => {
  const calls = [], router = createRouter(calls);
  assert.equal((await dispatch(router, 'POST', '/api/chip-details?chip=NRF52')).status, 200);
  const missing = await dispatch(router, 'DELETE', '/api/chip-details');
  assert.equal(missing.status, 400);
  assert.equal(missing.value.error, 'Missing "chip" or "part" parameter');
});
