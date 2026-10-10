import { once } from 'node:events';
import { startWebSocketLoopback } from '../websocket-loopback.js';

const portArgument = process.argv.find(value => value.startsWith('--port=')),
  port = portArgument ? Number(portArgument.slice('--port='.length)) : 18080;
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('--port must be an integer between 1 and 65535');

const server = startWebSocketLoopback({ port });
await once(server, 'listening');
console.log(`EmbedKit WebSocket loopback: ws://127.0.0.1:${port}`);

const shutdown = () => server.close(() => process.exit(0));
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
