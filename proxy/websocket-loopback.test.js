import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { startWebSocketLoopback } from './websocket-loopback.js';

const waitForMessage = socket => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('WebSocket message timeout')), 2000);
  socket.addEventListener('message', event => {
    clearTimeout(timer);
    resolve(event.data);
  }, { once: true });
});

const connect = async url => {
  const socket = new WebSocket(url);
  await once(socket, 'open');
  return socket;
};

test('runs real WebSocket text, binary, close and reconnect loopback', async () => {
  const server = startWebSocketLoopback();
  await once(server, 'listening');
  const address = server.address();
  assert.equal(typeof address, 'object');
  const url = `ws://127.0.0.1:${address.port}`;
  try {
    const first = await connect(url);
    first.send('embedkit-text');
    assert.equal(await waitForMessage(first), 'embedkit-text');

    first.binaryType = 'arraybuffer';
    first.send(Uint8Array.from([0x00, 0x7f, 0x80, 0xff]));
    assert.deepEqual(
      [...new Uint8Array(await waitForMessage(first))],
      [0x00, 0x7f, 0x80, 0xff],
    );
    const firstClosed = once(first, 'close');
    first.close(1000, 'completed');
    await firstClosed;

    const second = await connect(url);
    second.send('reconnected');
    assert.equal(await waitForMessage(second), 'reconnected');
    const secondClosed = once(second, 'close');
    second.close();
    await secondClosed;
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
