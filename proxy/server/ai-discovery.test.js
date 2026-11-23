import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_DISCOVERY_ADAPTER_VERSION, createAiDiscovery } from './ai-discovery.js';

const probe = (id, detect, apiVersion = AI_DISCOVERY_ADAPTER_VERSION) => ({ id, version: '1.0.0', apiVersion, detect });

test('AI discovery isolates failed probes and deduplicates stable server URLs', async () => {
  const discovery = createAiDiscovery({
    getJson: async () => ({}),
    probes: [
      probe('failed', async () => { throw new Error('offline'); }),
      probe('first', async () => [{ name: 'First', url: 'http://localhost:1000', models: [] }]),
      probe('duplicate', async () => [{ name: 'Duplicate', url: 'http://localhost:1000', models: [] }]),
      probe('second', async () => [{ name: 'Second', url: 'http://localhost:2000', models: [] }]),
    ],
  });
  assert.deepEqual((await discovery.detectServers()).map(server => server.name), ['First', 'Second']);
});

test('AI discovery ignores incompatible and malformed adapters', async () => {
  const discovery = createAiDiscovery({ probes: [probe('future', async () => [], 2), { id: 'invalid' }] });
  assert.deepEqual(await discovery.detectServers(), []);
});

test('default probes preserve empty Ollama as an available server without inventing a model', async () => {
  const calls = [];
  const discovery = createAiDiscovery({
    getJson: async url => {
      calls.push(url);
      if (url.endsWith('/api/tags')) return { models: [] };
      throw new Error('not running');
    },
  });
  const servers = await discovery.detectServers();
  assert.equal(servers[0].name, 'Ollama');
  assert.deepEqual(servers[0].models, []);
  assert.ok(calls.some(url => url.includes('/v1/models')));
});
