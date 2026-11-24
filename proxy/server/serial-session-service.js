import { randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';

export const SERIAL_SESSION_API_VERSION = 1;

export function validateSerialOptions(options = {}) {
  const path = String(options.path || '').trim();
  if (!path || path.length > 260 || /[\r\n\0]/.test(path)) throw new Error('Invalid serial port path');
  const baudRate = Number(options.baudRate ?? 115200), dataBits = Number(options.dataBits ?? 8), stopBits = Number(options.stopBits ?? 1);
  const parity = options.parity || 'none', flowControl = options.flowControl || 'none';
  const frameMode = options.frameMode || 'auto', frameGapMs = Number(options.frameGapMs ?? 30);
  if (!Number.isInteger(baudRate) || baudRate < 50 || baudRate > 12000000) throw new Error('Invalid serial baud rate');
  if (![5, 6, 7, 8].includes(dataBits)) throw new Error('Serial data bits must be 5, 6, 7 or 8');
  if (![1, 1.5, 2].includes(stopBits)) throw new Error('Serial stop bits must be 1, 1.5 or 2');
  if (!['none', 'even', 'odd', 'mark', 'space'].includes(parity)) throw new Error('Invalid serial parity');
  if (!['none', 'hardware'].includes(flowControl)) throw new Error('Invalid serial flow control');
  if (!['auto', 'line', 'idle', 'raw'].includes(frameMode)) throw new Error('Invalid serial frame mode');
  if (!Number.isFinite(frameGapMs) || frameGapMs < 5 || frameGapMs > 2000) throw new Error('Serial frame gap must be between 5 and 2000 ms');
  return { path, baudRate, dataBits, stopBits, parity, flowControl, dtr: options.dtr !== false, rts: options.rts === true, frameMode, frameGapMs };
}

export function pushSerialEvent(session, direction, bufferOrText, maxEvents = 2000) {
  const buffer = Buffer.isBuffer(bufferOrText) ? bufferOrText : null;
  session.lastEventId += 1;
  session.events.push({ id: session.lastEventId, timestamp: new Date().toISOString(), direction, text: buffer ? buffer.toString('utf8') : String(bufferOrText), hex: buffer ? buffer.toString('hex').match(/.{1,2}/g)?.join(' ').toUpperCase() || '' : '', byteLength: buffer?.length || Buffer.byteLength(String(bufferOrText)) });
  if (session.events.length > maxEvents) session.events.splice(0, session.events.length - maxEvents);
  if (direction === 'tx' && buffer) session.txBytes += buffer.length;
}

function flushSerialReceive(session, maxEvents = 2000) {
  if (!session.rxBuffer.length) return;
  const frame = session.rxBuffer; session.rxBuffer = Buffer.alloc(0); pushSerialEvent(session, 'rx', frame, maxEvents);
}

export function receiveSerialData(session, data, maxEvents = 2000) {
  session.rxBytes += data.length;
  if (session.frameMode === 'raw') { pushSerialEvent(session, 'rx', data, maxEvents); return; }
  session.rxBuffer = Buffer.concat([session.rxBuffer, data]);
  if (session.frameMode === 'auto' || session.frameMode === 'line') {
    for (;;) {
      const cr = session.rxBuffer.indexOf(13), lf = session.rxBuffer.indexOf(10), at = cr < 0 ? lf : lf < 0 ? cr : Math.min(cr, lf);
      if (at < 0) break;
      const frame = session.rxBuffer.subarray(0, at); let next = at;
      while (session.rxBuffer[next] === 10 || session.rxBuffer[next] === 13) next += 1;
      session.rxBuffer = session.rxBuffer.subarray(next);
      if (frame.length) pushSerialEvent(session, 'rx', frame, maxEvents);
    }
  }
  if (session.rxTimer) { clearTimeout(session.rxTimer); session.rxTimer = null; }
  if ((session.frameMode === 'auto' || session.frameMode === 'idle') && session.rxBuffer.length) session.rxTimer = setTimeout(() => { session.rxTimer = null; flushSerialReceive(session, maxEvents); }, session.frameGapMs);
}

export function createSerialSessionService({ adapter, stateFile, maxSessions = 16, maxEvents = 2000, restoreAttempts = 8, restoreDelayMs = 500, logger = console } = {}) {
  if (!adapter || typeof adapter.list !== 'function' || typeof adapter.create !== 'function') throw new Error('Serial adapter must provide list() and create()');
  const sessions = new Map();
  let serialAdapter = adapter, restoring = false;
  const listPorts = async () => (await serialAdapter.list()).map(port => ({ path: port.path, manufacturer: port.manufacturer || '', serialNumber: port.serialNumber || '', vendorId: port.vendorId || '', productId: port.productId || '', pnpId: port.pnpId || '', friendlyName: port.friendlyName || port.path }));
  const persist = async () => {
    if (!stateFile) return;
    const saved = [...sessions.values()].filter(session => session.state === 'connected').map(({ path, baudRate, dataBits, stopBits, parity, flowControl, dtr, rts, frameMode, frameGapMs }) => ({ path, baudRate, dataBits, stopBits, parity, flowControl, dtr, rts, frameMode, frameGapMs }));
    try { await mkdir(dirname(stateFile), { recursive: true }); await writeFile(stateFile, JSON.stringify({ version: 1, sessions: saved }, null, 2), 'utf8'); }
    catch (error) { logger.warn(`Unable to save serial sessions: ${error.message}`); }
  };
  const createSession = async input => {
    const options = validateSerialOptions(input), available = await listPorts();
    if (!available.some(port => port.path.toLowerCase() === options.path.toLowerCase())) throw new Error(`Serial port is not available: ${options.path}`);
    const existing = [...sessions.values()].find(session => session.path.toLowerCase() === options.path.toLowerCase() && session.state === 'connected');
    if (existing) {
      if (existing.baudRate !== options.baudRate || existing.dataBits !== options.dataBits || existing.stopBits !== options.stopBits || existing.parity !== options.parity || existing.flowControl !== options.flowControl || existing.frameMode !== options.frameMode || existing.frameGapMs !== options.frameGapMs) throw new Error(`${options.path} is already open with different settings`);
      return { session: existing, reused: true };
    }
    if (sessions.size >= maxSessions) throw new Error(`At most ${maxSessions} serial sessions may be open`);
    const id = randomUUID(), port = serialAdapter.create({ path: options.path, baudRate: options.baudRate, dataBits: options.dataBits, stopBits: options.stopBits, parity: options.parity, rtscts: options.flowControl === 'hardware', autoOpen: false });
    const session = { id, ...options, state: 'connecting', events: [], lastEventId: 0, rxBytes: 0, txBytes: 0, openedAt: new Date().toISOString(), port, rxBuffer: Buffer.alloc(0), rxTimer: null };
    sessions.set(id, session); pushSerialEvent(session, 'system', `正在打开 ${options.path} · ${options.baudRate} ${options.dataBits}${options.parity === 'none' ? 'N' : options.parity[0].toUpperCase()}${options.stopBits}`, maxEvents);
    port.on('data', data => receiveSerialData(session, data, maxEvents));
    port.on('error', error => { session.state = 'error'; pushSerialEvent(session, 'system', `串口错误：${error.message}`, maxEvents); });
    port.on('close', error => { if (session.state !== 'closed') { session.state = 'closed'; pushSerialEvent(session, 'system', error ? `串口异常关闭：${error.message}` : '串口已关闭', maxEvents); } });
    try {
      await new Promise((resolveOpen, reject) => port.open(error => error ? reject(error) : resolveOpen())); session.state = 'connected';
      try { await new Promise((resolveSignal, reject) => port.set({ dtr: options.dtr, rts: options.rts }, error => error ? reject(error) : resolveSignal())); }
      catch (error) { pushSerialEvent(session, 'system', `控制信号未应用，串口收发继续运行：${error.message}`, maxEvents); }
      pushSerialEvent(session, 'system', `${options.path} 已连接`, maxEvents); if (!restoring) await persist(); return { session, reused: false };
    } catch (error) { session.state = 'error'; pushSerialEvent(session, 'system', `打开失败：${error.message}`, maxEvents); sessions.delete(id); try { if (port.isOpen) port.close(); } catch { /* already closed */ } throw error; }
  };
  return {
    apiVersion: SERIAL_SESSION_API_VERSION,
    size: () => sessions.size, maxSessions,
    configureAdapter(next) { if (!next || typeof next.list !== 'function' || typeof next.create !== 'function') throw new Error('Serial adapter must provide list() and create()'); serialAdapter = next; },
    listPorts, listSessions: () => [...sessions.values()], getSession: id => sessions.get(id), removeSession: id => sessions.delete(id), createSession, persist,
    publicSession(session, after = 0) { const { port: _port, rxBuffer: _rxBuffer, rxTimer: _rxTimer, ...safe } = session; return { ...safe, events: session.events.filter(event => event.id > after) }; },
    pushEvent: (session, direction, value) => pushSerialEvent(session, direction, value, maxEvents),
    async closeSession(session) { if (!session || session.state === 'closed') return; session.state = 'closed'; if (session.rxTimer) { clearTimeout(session.rxTimer); session.rxTimer = null; } flushSerialReceive(session, maxEvents); if (session.port.isOpen) await new Promise(resolveClose => session.port.close(() => resolveClose())); pushSerialEvent(session, 'system', '串口会话已关闭', maxEvents); },
    async restore() {
      if (!stateFile) return;
      let saved; try { saved = JSON.parse(await readFile(stateFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') logger.warn(`Unable to read saved serial sessions: ${error.message}`); return; }
      if (!Array.isArray(saved?.sessions)) return;
      let failures = 0; restoring = true;
      try {
        for (const options of saved.sessions.slice(0, maxSessions)) {
          let restored = false, lastError;
          for (let attempt = 1; attempt <= restoreAttempts && !restored; attempt += 1) { try { const { session } = await createSession(options); pushSerialEvent(session, 'system', '已自动恢复上次串口会话', maxEvents); restored = true; } catch (error) { lastError = error; if (attempt < restoreAttempts) await new Promise(resolveDelay => setTimeout(resolveDelay, restoreDelayMs)); } }
          if (!restored) { failures += 1; logger.warn(`Unable to restore serial session ${options?.path || ''}: ${lastError?.message || 'unknown error'}`); }
        }
      } finally { restoring = false; }
      if (!failures) await persist();
    },
  };
}
