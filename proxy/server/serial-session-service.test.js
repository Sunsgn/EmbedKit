import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSerialSessionService, pushSerialEvent } from './serial-session-service.js';

test('serial event history is bounded while byte counters remain cumulative', () => {
  const session = { lastEventId: 0, events: [], txBytes: 0 };
  pushSerialEvent(session, 'tx', Buffer.from([1, 2]), 2);
  pushSerialEvent(session, 'system', 'middle', 2);
  pushSerialEvent(session, 'tx', Buffer.from([3]), 2);
  assert.deepEqual(session.events.map(event => event.id), [2, 3]);
  assert.equal(session.txBytes, 3);
});

test('serial restore degrades safely when persisted state is damaged', async () => {
  const root = await mkdtemp(join(tmpdir(), 'embedkit-serial-state-'));
  try {
    const stateFile = join(root, 'sessions.json'), warnings = [];
    await writeFile(stateFile, '{damaged', 'utf8');
    const service = createSerialSessionService({
      adapter: { list: async () => [], create: () => { throw new Error('must not open'); } },
      stateFile,
      logger: { warn: message => warnings.push(message) },
    });
    await service.restore();
    assert.equal(service.size(), 0);
    assert.match(warnings[0], /Unable to read saved serial sessions/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
