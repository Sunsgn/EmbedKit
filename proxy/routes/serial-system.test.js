import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentRouter } from '../server/router.js';
import { registerSerialSystemRoutes } from './serial-system.js';

const dispatch = async (router, method, pathname, body = {}) => {
  const res = {};
  await router.dispatch({ req: { method, body }, res, pathname, requestUrl: new URL(`http://localhost${pathname}`) });
  return res;
};

const createRouter = overrides => registerSerialSystemRoutes(new AgentRouter(), {
  jsonResponse: (res, status, value) => { res.status = status; res.value = value; },
  readJsonBody: async req => req.body,
  status: () => ({ available: true, activeSessions: 1, maxSessions: 8 }),
  listPorts: async () => [{ path: 'virtual://loopback' }],
  scanDrivers: async () => ({ supported: true, devices: [] }),
  installDriver: async body => ({ state: 'completed', confirmed: body.confirmed }),
  ...overrides,
});

test('serial system routes expose status, ports, driver evidence, and controlled installation', async () => {
  const router = createRouter();
  assert.deepEqual((await dispatch(router, 'GET', '/api/serial/status')).value, { available: true, activeSessions: 1, maxSessions: 8 });
  assert.deepEqual((await dispatch(router, 'GET', '/api/serial/ports')).value.ports, [{ path: 'virtual://loopback' }]);
  assert.equal((await dispatch(router, 'GET', '/api/serial/drivers')).value.supported, true);
  const installed = await dispatch(router, 'POST', '/api/serial/drivers/install', { confirmed: true });
  assert.deepEqual(installed.value, { state: 'completed', confirmed: true });
});

test('serial system routes preserve scan, permission, and validation failure classes', async () => {
  const scanFailure = await dispatch(createRouter({ scanDrivers: async () => { throw new Error('scan failed'); } }), 'GET', '/api/serial/drivers');
  assert.equal(scanFailure.status, 500);
  assert.equal(scanFailure.value.code, 'serial-driver-scan-failed');
  const permissionFailure = await dispatch(createRouter({ installDriver: async () => { throw new Error('exited with code 5'); } }), 'POST', '/api/serial/drivers/install');
  assert.equal(permissionFailure.status, 403);
  assert.equal(permissionFailure.value.code, 'administrator-required');
  const validationFailure = await dispatch(createRouter({ installDriver: async () => { throw new Error('confirmation required'); } }), 'POST', '/api/serial/drivers/install');
  assert.equal(validationFailure.status, 400);
  assert.equal(validationFailure.value.code, 'serial-driver-install-failed');
});
