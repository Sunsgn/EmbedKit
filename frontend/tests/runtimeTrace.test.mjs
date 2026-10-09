import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRuntimeTrace, staticCoverage } from '../src/utils/runtimeTrace.ts';

test('parses JSONL and generic EK trace events', () => {
  const result = parseRuntimeTrace(`{"timestamp":1,"type":"enter","name":"main","context":"boot"}
EK|2|task|SensorTask|worker
EK|3|state|NET_ONLINE|network`);
  assert.equal(result.events.length, 3);
  assert.equal(result.events[1].name, 'SensorTask');
  assert.deepEqual(result.contexts, ['boot', 'worker', 'network']);
});

test('correlates real events with static flow nodes', () => {
  const trace = parseRuntimeTrace('EK|1|enter|main|boot\nEK|2|enter|network_connect|worker\nEK|3|event|unexpected_callback|irq');
  const coverage = staticCoverage(['main', 'network_connect', 'sensor_poll'], trace);
  assert.equal(coverage.rate, 2 / 3);
  assert.deepEqual(coverage.missing, ['sensor_poll']);
  assert.deepEqual(coverage.extra, ['unexpected_callback']);
});
