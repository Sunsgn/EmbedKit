import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAgentLogger, formatAgentLogValue } from './agent-logger.js';

test('agent logger redacts common credentials and tolerates circular values', () => {
  assert.equal(formatAgentLogValue('Authorization: Bearer abc.def'), 'Authorization: Bearer [REDACTED]');
  assert.equal(formatAgentLogValue('token=private-value'), 'token=[REDACTED]');
  const circular = {}; circular.self = circular;
  assert.equal(formatAgentLogValue(circular), '[Unserializable value]');
});

test('agent logger rotates bounded files without dropping the active message', async () => {
  const root = await mkdtemp(join(tmpdir(), 'embedkit-agent-log-'));
  try {
    const file = join(root, 'agent.log');
    const logger = createAgentLogger({ file, maxBytes: 120, maxBackups: 2 });
    await logger.write('log', ['first', 'x'.repeat(60)]);
    await logger.write('warn', ['second', 'y'.repeat(60)]);

    const current = await readFile(file, 'utf8');
    const previous = await readFile(`${file}.1`, 'utf8');
    assert.match(current, /second/);
    assert.match(previous, /first/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
