import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNetworkSessionService } from './network-session-service.js';

test('network event history is bounded while byte counters remain cumulative', () => {
  const service = createNetworkSessionService({ maxEvents: 2 });
  const session = { lastEventId: 0, events: [], droppedEvents: 0, txBytes: 0 };

  service.pushEvent(session, 'tx', Buffer.from([1, 2]));
  service.pushEvent(session, 'system', 'middle');
  service.pushEvent(session, 'tx', Buffer.from([3]));

  assert.deepEqual(session.events.map(event => event.id), [2, 3]);
  assert.equal(session.droppedEvents, 1);
  assert.equal(session.txBytes, 3);
});

test('network restore degrades safely when persisted state is damaged', async () => {
  const root = await mkdtemp(join(tmpdir(), 'embedkit-network-state-'));
  try {
    const stateFile = join(root, 'sessions.json');
    const warnings = [];
    await writeFile(stateFile, '{damaged', 'utf8');
    const service = createNetworkSessionService({
      stateFile,
      logger: { warn: message => warnings.push(message) },
    });

    await service.restore();

    assert.equal(service.size(), 0);
    assert.match(warnings[0], /Unable to read saved network sessions/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('network session validation rejects unsupported framing before opening a socket', () => {
  let socketCreated = false;
  const service = createNetworkSessionService({
    dgramAdapter: { createSocket: () => { socketCreated = true; } },
  });

  assert.throws(
    () => service.createSession('udp', '127.0.0.1', 9000, 0, 'client', 10_000, 'packet'),
    /Invalid network frame mode/,
  );
  assert.equal(socketCreated, false);
  assert.equal(service.size(), 0);
});
