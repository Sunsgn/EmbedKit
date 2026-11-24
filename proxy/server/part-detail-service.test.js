import assert from 'node:assert/strict';
import test from 'node:test';
import { createPartDetailService } from './part-detail-service.js';

test('part detail service uses injected providers and preserves official product navigation', async () => {
  const service = createPartDetailService({
    providers: [{ id: 'fixture', lookup: async model => ({ productName: model, description: 'Verified fixture data', source: 'fixture' }) }],
  });

  const result = await service.lookup('ESP32-C3');

  assert.equal(result.productName, 'ESP32-C3');
  assert.equal(result.source, 'fixture');
  assert.equal(result.productUrl, 'https://www.espressif.com/en/products/socs/details/esp32-c3');
});

test('part detail service degrades with provider evidence instead of inventing specifications', async () => {
  const service = createPartDetailService({
    providers: [
      { id: 'failed', lookup: async () => { throw new Error('offline'); } },
      { id: 'empty', lookup: async () => null },
    ],
  });

  const result = await service.lookup('UNKNOWN-123');

  assert.match(result.error, /No data found/);
  assert.equal(result.source, 'Unavailable');
  assert.equal(result.failures[0].provider, 'failed');
  assert.equal(result.failures[0].code, 'lookup-failed');
  assert.equal('specs' in result, false);
});

test('part detail service validates model input and bounds provider execution', async () => {
  let calls = 0;
  const providers = Array.from({ length: 10 }, (_, index) => ({ id: `provider-${index}`, lookup: async () => { calls += 1; return null; } }));
  const service = createPartDetailService({ providers });

  await service.lookup('VALID-1');
  assert.equal(calls, 8);
  await assert.rejects(service.lookup('../invalid'), /Invalid part model/);
});
