import crypto from 'node:crypto';
import http from 'node:http';

const websocketGuid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function encodeFrame(opcode, payload = Buffer.alloc(0)) {
  const data = Buffer.from(payload);
  if (data.length < 126)
    return Buffer.concat([Buffer.from([0x80 | opcode, data.length]), data]);
  if (data.length <= 0xffff) {
    const header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(data.length, 2);
    return Buffer.concat([header, data]);
  }
  throw new Error('WebSocket loopback frames are limited to 65535 bytes');
}

function decodeFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (buffer.length - offset >= 2) {
    const first = buffer[offset], second = buffer[offset + 1],
      masked = Boolean(second & 0x80);
    let length = second & 0x7f, headerLength = 2;
    if (length === 126) {
      if (buffer.length - offset < 4) break;
      length = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (length === 127) {
      throw new Error('WebSocket loopback frames larger than 65535 bytes are unsupported');
    }
    const maskLength = masked ? 4 : 0,
      frameLength = headerLength + maskLength + length;
    if (buffer.length - offset < frameLength) break;
    const maskOffset = offset + headerLength,
      payloadOffset = maskOffset + maskLength,
      payload = Buffer.from(buffer.subarray(payloadOffset, payloadOffset + length));
    if (masked)
      for (let index = 0; index < payload.length; index += 1)
        payload[index] ^= buffer[maskOffset + (index % 4)];
    frames.push({ fin: Boolean(first & 0x80), opcode: first & 0x0f, payload });
    offset += frameLength;
  }
  return { frames, remaining: buffer.subarray(offset) };
}

export function startWebSocketLoopback({ host = '127.0.0.1', port = 0 } = {}) {
  const sockets = new Set();
  const server = http.createServer((_, response) => {
    response.writeHead(426, { 'Content-Type': 'text/plain' });
    response.end('WebSocket upgrade required');
  });
  server.on('upgrade', (request, socket) => {
    const key = request.headers['sec-websocket-key'];
    if (!key || request.headers.upgrade?.toLowerCase() !== 'websocket') {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }
    const accept = crypto
      .createHash('sha1')
      .update(`${key}${websocketGuid}`)
      .digest('base64');
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '',
      '',
    ].join('\r\n'));
    sockets.add(socket);
    let pending = Buffer.alloc(0);
    socket.on('data', chunk => {
      pending = Buffer.concat([pending, chunk]);
      try {
        const decoded = decodeFrames(pending);
        pending = decoded.remaining;
        for (const frame of decoded.frames) {
          if (!frame.fin) throw new Error('Fragmented frames are unsupported');
          if (frame.opcode === 0x1 || frame.opcode === 0x2)
            socket.write(encodeFrame(frame.opcode, frame.payload));
          else if (frame.opcode === 0x8) {
            socket.end(encodeFrame(0x8, frame.payload));
            break;
          } else if (frame.opcode === 0x9)
            socket.write(encodeFrame(0xa, frame.payload));
        }
      } catch (error) {
        socket.destroy(error);
      }
    });
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => sockets.delete(socket));
  });
  server.on('close', () => {
    for (const socket of sockets) socket.destroy();
    sockets.clear();
  });
  server.listen(port, host);
  return server;
}
