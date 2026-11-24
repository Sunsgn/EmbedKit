import assert from 'node:assert/strict';
import test from 'node:test';
import { classifySerialDriverDevice, createSerialDriverService } from './serial-driver-service.js';

test('serial driver classification preserves unknown USB evidence without guessing a vendor', () => {
  const result = classifySerialDriverDevice({
    instanceId: 'USB\\VID_ABCD&PID_1234\\DEVICE',
    problemCode: 28,
    hardwareIds: ['USB\\VID_ABCD&PID_1234'],
  });

  assert.equal(result.vendorId, 'ABCD');
  assert.equal(result.productId, '1234');
  assert.equal(result.driverState, 'missing');
  assert.equal(result.recommendation, null);
  assert.match(result.evidence, /VID_ABCD/);
});

test('serial driver service safely degrades on unsupported platforms', async () => {
  let listed = false;
  const service = createSerialDriverService({
    platform: 'linux',
    listPorts: async () => { listed = true; return []; },
  });

  const result = await service.scan();

  assert.equal(result.supported, false);
  assert.equal(result.platform, 'linux');
  assert.deepEqual(result.devices, []);
  assert.equal(listed, false);
});

test('serial driver adapter contract rejects incomplete platform adapters', () => {
  const service = createSerialDriverService({ platform: 'test', listPorts: async () => [] });
  assert.throws(() => service.configureAdapter({ platform: 'win32', scan: async () => [] }), /must provide platform, scan\(\) and install\(\)/);
});
