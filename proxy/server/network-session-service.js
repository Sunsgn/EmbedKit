import { randomUUID } from 'crypto';
import dgram from 'dgram';
import net from 'net';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';

export const NETWORK_SESSION_API_VERSION = 1;

export function validateHostAndPort(host, port) {
  if (typeof host !== 'string' || !host.trim() || host.length > 255 || /[\s/\\]/.test(host)) throw new Error('Invalid target host');
  const parsedPort = Number(port);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) throw new Error('Port must be between 1 and 65535');
  return { host: host.trim(), port: parsedPort };
}

export function decodeNetworkPayload(data, encoding) {
  if (typeof data !== 'string') throw new Error('Data must be a string');
  if (encoding === 'text') return Buffer.from(data, 'utf8');
  if (encoding === 'hex') {
    const normalized = data.replace(/0x/gi, '').replace(/[\s,;:_-]+/g, '');
    if (!normalized || !/^[0-9a-f]+$/i.test(normalized) || normalized.length % 2) throw new Error('Invalid HEX payload');
    return Buffer.from(normalized, 'hex');
  }
  throw new Error('Encoding must be text or hex');
}

export function createNetworkSessionService({
  stateFile,
  maxSessions = 16,
  maxEvents = 2000,
  maxPeers = 64,
  maxFrameBytes = 64 * 1024,
  defaultConnectTimeoutMs = 10_000,
  defaultFrameGapMs = 30,
  netAdapter = net,
  dgramAdapter = dgram,
  logger = console,
} = {}) {
  const sessions = new Map();
  const pushEvent = (session, direction, value) => {
    const buffer = Buffer.isBuffer(value) ? value : null;
    session.lastEventId += 1;
    session.events.push({ id: session.lastEventId, timestamp: new Date().toISOString(), direction, text: buffer ? buffer.toString('utf8') : String(value), hex: buffer ? buffer.toString('hex').match(/.{1,2}/g)?.join(' ').toUpperCase() || '' : '', byteLength: buffer?.length || Buffer.byteLength(String(value)) });
    if (session.events.length > maxEvents) { const removed = session.events.length - maxEvents; session.events.splice(0, removed); session.droppedEvents += removed; }
    if (direction === 'tx' && buffer) session.txBytes += buffer.length;
  };
  const publicSession = (session, after = 0) => ({
    id: session.id, type: session.type, mode: session.mode, host: session.host, port: session.port, localPort: session.localPort,
    localAddress: session.localAddress, state: session.state, rxBytes: session.rxBytes, txBytes: session.txBytes,
    clientCount: session.clients?.size || 0, peers: [...session.peers.values()].map(peer => ({ ...peer })).slice(-maxPeers),
    droppedEvents: session.droppedEvents, firstEventId: session.events[0]?.id ?? session.lastEventId + 1,
    connectTimeoutMs: session.connectTimeoutMs, frameMode: session.frameMode, frameGapMs: session.frameGapMs,
    events: session.events.filter(event => event.id > after),
  });
  const trimPeers = session => { while (session.peers.size > maxPeers) { const removable = [...session.peers.entries()].find(([, peer]) => !peer.connected)?.[0] ?? session.peers.keys().next().value; session.peers.delete(removable); } };
  const pushFrame = (session, buffer, peer) => { if (!buffer.length) return; pushEvent(session, 'rx', buffer); if (peer) session.events[session.events.length - 1].peer = peer; };
  const flushReceive = (session, peer = '') => { const frame = session.rxBuffers.get(peer); if (!frame?.length) return; session.rxBuffers.delete(peer); pushFrame(session, frame, peer || undefined); };
  const clearTimer = (session, peer) => { const timer = session.rxTimers.get(peer); if (timer) clearTimeout(timer); session.rxTimers.delete(peer); };
  const flushAll = session => { for (const peer of [...session.rxTimers.keys()]) clearTimer(session, peer); for (const peer of [...session.rxBuffers.keys()]) flushReceive(session, peer); };
  const receiveData = (session, data, peer = '') => {
    session.rxBytes += data.length;
    if (session.type === 'udp' || session.frameMode === 'raw' || session.frameMode === 'chunk') { pushFrame(session, data, peer || undefined); return; }
    session.rxBuffers.set(peer, Buffer.concat([session.rxBuffers.get(peer) ?? Buffer.alloc(0), data]));
    if (session.frameMode === 'auto' || session.frameMode === 'line') {
      for (;;) {
        const buffered = session.rxBuffers.get(peer) ?? Buffer.alloc(0), cr = buffered.indexOf(13), lf = buffered.indexOf(10), at = cr < 0 ? lf : lf < 0 ? cr : Math.min(cr, lf);
        if (at < 0) break;
        let end = at + 1; if (buffered[at] === 13 && buffered[end] === 10) end += 1;
        if (end > maxFrameBytes) { session.rxBuffers.set(peer, buffered.subarray(maxFrameBytes)); pushFrame(session, buffered.subarray(0, maxFrameBytes), peer || undefined); pushEvent(session, 'system', `接收缓存达到 ${maxFrameBytes} 字节，已强制分帧`); continue; }
        session.rxBuffers.set(peer, buffered.subarray(end)); pushFrame(session, buffered.subarray(0, end), peer || undefined);
      }
    }
    let buffered = session.rxBuffers.get(peer) ?? Buffer.alloc(0);
    while (buffered.length >= maxFrameBytes) { pushFrame(session, buffered.subarray(0, maxFrameBytes), peer || undefined); buffered = buffered.subarray(maxFrameBytes); session.rxBuffers.set(peer, buffered); pushEvent(session, 'system', `接收缓存达到 ${maxFrameBytes} 字节，已强制分帧`); }
    clearTimer(session, peer);
    if ((session.frameMode === 'auto' || session.frameMode === 'idle') && buffered.length) session.rxTimers.set(peer, setTimeout(() => { session.rxTimers.delete(peer); flushReceive(session, peer); }, session.frameGapMs));
  };
  const closeSession = (session, reason = '会话已关闭') => {
    if (!session || session.state === 'closed') return;
    session.state = 'closed'; flushAll(session);
    if (session.type === 'tcp' && session.mode === 'server') { for (const client of session.clients.values()) client.destroy(); try { session.socket.close(); } catch { /* not listening */ } }
    else if (session.type === 'tcp') session.socket.destroy(); else { try { session.socket.close(); } catch { /* already closed */ } }
    pushEvent(session, 'system', reason);
  };
  const createSession = (type, host, port, localPort, mode = 'client', connectTimeoutMs = defaultConnectTimeoutMs, frameMode = 'raw', frameGapMs = defaultFrameGapMs) => {
    if (!['tcp', 'udp'].includes(type)) throw new Error('Only TCP and UDP sessions are supported');
    if (!['client', 'server'].includes(mode)) throw new Error('Mode must be client or server');
    if (sessions.size >= maxSessions) throw new Error(`At most ${maxSessions} network sessions may be open`);
    const target = validateHostAndPort(host, port), bindPort = type === 'udp' && mode === 'client' ? Number(localPort || 0) : 0;
    if (!Number.isInteger(bindPort) || bindPort < 0 || bindPort > 65535) throw new Error('Local port must be between 0 and 65535');
    const boundedConnectTimeoutMs = Math.max(1000, Math.min(120_000, Number(connectTimeoutMs) || defaultConnectTimeoutMs));
    const selectedFrameMode = String(frameMode || 'raw'), boundedFrameGapMs = Number(frameGapMs ?? defaultFrameGapMs);
    if (!['raw', 'chunk', 'auto', 'line', 'idle'].includes(selectedFrameMode)) throw new Error('Invalid network frame mode');
    if (!Number.isFinite(boundedFrameGapMs) || boundedFrameGapMs < 5 || boundedFrameGapMs > 2000) throw new Error('Network frame gap must be between 5 and 2000 ms');
    const id = randomUUID(), session = { id, type, mode, ...target, localPort: bindPort, connectTimeoutMs: boundedConnectTimeoutMs, frameMode: type === 'udp' ? 'chunk' : selectedFrameMode, frameGapMs: boundedFrameGapMs, localAddress: '', state: 'connecting', events: [], droppedEvents: 0, lastEventId: 0, rxBytes: 0, txBytes: 0, socket: null, clients: new Map(), peers: new Map(), lastPeer: null, rxBuffers: new Map(), rxTimers: new Map() };
    sessions.set(id, session); pushEvent(session, 'system', mode === 'server' ? `正在监听 ${type.toUpperCase()} ${target.host}:${target.port}` : `正在连接 ${type.toUpperCase()} ${target.host}:${target.port}`);
    if (type === 'tcp' && mode === 'client') {
      const socket = netAdapter.createConnection({ host: target.host, port: target.port }); session.socket = socket; socket.setNoDelay(true);
      const timer = setTimeout(() => socket.destroy(new Error(`TCP connection timed out after ${boundedConnectTimeoutMs}ms`)), boundedConnectTimeoutMs);
      socket.on('connect', () => { clearTimeout(timer); session.state = 'connected'; session.localAddress = `${socket.localAddress}:${socket.localPort}`; pushEvent(session, 'system', `已连接 ${target.host}:${target.port}`); });
      socket.on('data', data => receiveData(session, data)); socket.on('error', error => { clearTimeout(timer); session.state = 'error'; pushEvent(session, 'system', `TCP 错误：${error.message}`); });
      socket.on('close', () => { clearTimeout(timer); clearTimer(session, ''); flushReceive(session); if (session.state !== 'closed') { session.state = 'closed'; pushEvent(session, 'system', 'TCP 连接已断开'); } });
    } else if (type === 'tcp') {
      const server = netAdapter.createServer(socket => {
        if (session.clients.size >= maxPeers) { pushEvent(session, 'system', `已拒绝客户端：最多允许 ${maxPeers} 个连接`); socket.destroy(); return; }
        const peer = `${socket.remoteAddress}:${socket.remotePort}`, connectedAt = new Date().toISOString(); session.clients.set(peer, socket); session.peers.set(peer, { id: peer, address: socket.remoteAddress, port: socket.remotePort, connected: true, connectedAt, lastSeenAt: connectedAt, rxBytes: 0, txBytes: 0 }); trimPeers(session); pushEvent(session, 'system', `客户端已连接 ${peer}`); socket.setNoDelay(true);
        socket.on('data', data => { const evidence = session.peers.get(peer); if (evidence) { evidence.rxBytes += data.length; evidence.lastSeenAt = new Date().toISOString(); } receiveData(session, data, peer); }); socket.on('error', error => pushEvent(session, 'system', `客户端 ${peer} 错误：${error.message}`));
        socket.on('close', () => { clearTimer(session, peer); flushReceive(session, peer); session.clients.delete(peer); const evidence = session.peers.get(peer); if (evidence) { evidence.connected = false; evidence.lastSeenAt = new Date().toISOString(); } pushEvent(session, 'system', `客户端已断开 ${peer}`); });
      });
      session.socket = server; server.on('error', error => { session.state = 'error'; pushEvent(session, 'system', `TCP 监听错误：${error.message}`); }); server.on('close', () => { if (session.state !== 'closed') session.state = 'closed'; });
      server.listen(target.port, target.host, () => { const address = server.address(); session.state = 'connected'; session.localAddress = typeof address === 'object' && address ? `${address.address}:${address.port}` : `${target.host}:${target.port}`; pushEvent(session, 'system', `TCP 服务端正在监听 ${session.localAddress}`); });
    } else {
      const socket = dgramAdapter.createSocket('udp4'); session.socket = socket;
      socket.on('message', (data, info) => { if (mode === 'server') session.lastPeer = info; const peer = `${info.address}:${info.port}`, timestamp = new Date().toISOString(), evidence = session.peers.get(peer) ?? { id: peer, address: info.address, port: info.port, connected: true, connectedAt: timestamp, lastSeenAt: timestamp, rxBytes: 0, txBytes: 0 }; evidence.rxBytes += data.length; evidence.lastSeenAt = timestamp; session.peers.set(peer, evidence); trimPeers(session); receiveData(session, data, peer); });
      socket.on('error', error => { session.state = 'error'; pushEvent(session, 'system', mode === 'server' ? `UDP 监听错误：${error.message}` : `UDP 错误：${error.message}`); }); socket.on('close', () => { session.state = 'closed'; });
      if (mode === 'client') socket.bind(bindPort, '0.0.0.0', () => socket.connect(target.port, target.host, () => { const address = socket.address(); session.state = 'connected'; session.localAddress = `${address.address}:${address.port}`; pushEvent(session, 'system', `UDP 已就绪，目标 ${target.host}:${target.port}`); }));
      else socket.bind(target.port, target.host, () => { const address = socket.address(); session.state = 'connected'; session.localAddress = `${address.address}:${address.port}`; pushEvent(session, 'system', `UDP 服务端正在监听 ${session.localAddress}`); });
    }
    return session;
  };
  const persist = async () => {
    if (!stateFile) return;
    const saved = [...sessions.values()].filter(session => session.state !== 'closed').map(({ type, mode, host, port, localPort, connectTimeoutMs, frameMode, frameGapMs }) => ({ type, mode, host, port, localPort, connectTimeoutMs, frameMode, frameGapMs }));
    try { await mkdir(dirname(stateFile), { recursive: true }); await writeFile(stateFile, JSON.stringify({ version: 1, sessions: saved }, null, 2), 'utf8'); } catch (error) { logger.warn(`Unable to save network sessions: ${error.message}`); }
  };
  return {
    apiVersion: NETWORK_SESSION_API_VERSION, size: () => sessions.size, maxSessions,
    listSessions: () => [...sessions.values()], getSession: id => sessions.get(id), removeSession: id => sessions.delete(id), createSession,
    publicSession, pushEvent, closeSession, persist, receiveData,
    writeTcp(socket, payload) { return new Promise((resolveWrite, reject) => { if (!socket?.writable) { reject(new Error('TCP target is not writable')); return; } socket.write(payload, error => error ? reject(error) : resolveWrite()); }); },
    sendUdp(socket, payload, peer) { return new Promise((resolveSend, reject) => { const callback = error => error ? reject(error) : resolveSend(); if (peer) socket.send(payload, peer.port, peer.address, callback); else socket.send(payload, callback); }); },
    async restore() {
      if (!stateFile) return;
      let saved; try { saved = JSON.parse(await readFile(stateFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') logger.warn(`Unable to read saved network sessions: ${error.message}`); return; }
      if (!Array.isArray(saved?.sessions)) return;
      for (const options of saved.sessions.slice(0, maxSessions)) { try { const session = createSession(options.type, options.host, options.port, options.localPort, options.mode, options.connectTimeoutMs, options.frameMode, options.frameGapMs); pushEvent(session, 'system', '已自动恢复上次网络会话'); } catch (error) { logger.warn(`Unable to restore network session ${options?.type || ''} ${options?.host || ''}:${options?.port || ''}: ${error.message}`); } }
      await persist();
    },
  };
}
