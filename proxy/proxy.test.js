import assert from 'node:assert/strict';
import test from 'node:test';
import net from 'node:net';
import dgram from 'node:dgram';
import { EventEmitter, once } from 'node:events';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { authorizeBuildArtifact, configureFilePickerAdapter, configureSerialAdapter, createBuildCommand, decodeNetworkPayload, isAllowedOrigin, parseBuildDiagnostic, receiveSerialData, startServer, validateHostAndPort, validateProxyTarget, validateSerialOptions } from './proxy.js';

class VirtualSerialPort extends EventEmitter {
  constructor(options) { super(); this.options = options; this.isOpen = false; this.signals = { dtr: false, rts: false }; }
  open(callback) { this.isOpen = true; queueMicrotask(() => callback()); }
  close(callback) { this.isOpen = false; queueMicrotask(() => { this.emit('close'); callback?.(); }); }
  write(payload, callback) { const copy = Buffer.from(payload); queueMicrotask(() => { this.emit('data', copy); callback(); }); }
  drain(callback) { queueMicrotask(() => callback()); }
  set(signals, callback) { this.signals = { ...this.signals, ...signals }; queueMicrotask(() => callback()); }
  update(options, callback) { this.options = { ...this.options, ...options }; queueMicrotask(() => callback()); }
}

const virtualSerialAdapter = {
  list: async () => [{ path: 'VIRTUAL0', manufacturer: 'EmbedKit', serialNumber: 'EK-LOOP-1', friendlyName: 'EmbedKit Virtual Loopback' }],
  create: options => new VirtualSerialPort(options),
};

function elfWithMainSymbol() {
  const bytes = Buffer.alloc(0x380), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), sectionNames = Buffer.from('\0.shstrtab\0.text\0.symtab\0.strtab\0'), symbolNames = Buffer.from('\0main\0');
  bytes.set([0x7f, 0x45, 0x4c, 0x46, 1, 1, 1]);
  view.setUint16(16, 2, true); view.setUint16(18, 40, true); view.setUint32(20, 1, true); view.setUint32(24, 0x08000101, true);
  view.setUint32(32, 0x200, true); view.setUint16(40, 52, true); view.setUint16(46, 40, true); view.setUint16(48, 5, true); view.setUint16(50, 1, true);
  bytes.set(sectionNames, 0x80); bytes.set(symbolNames, 0xc0);
  const section = (index, name, type, flags, address, offset, size, entrySize = 0, link = 0) => { const base = 0x200 + index * 40; view.setUint32(base, name, true); view.setUint32(base + 4, type, true); view.setUint32(base + 8, flags, true); view.setUint32(base + 12, address, true); view.setUint32(base + 16, offset, true); view.setUint32(base + 20, size, true); view.setUint32(base + 24, link, true); view.setUint32(base + 36, entrySize, true); };
  section(1, 1, 3, 0, 0, 0x80, sectionNames.length); section(2, 11, 1, 6, 0x08000100, 0x100, 32); section(3, 17, 2, 0, 0, 0x120, 32, 16, 4); section(4, 25, 3, 0, 0, 0xc0, symbolNames.length);
  view.setUint32(0x130, 1, true); view.setUint32(0x134, 0x08000101, true); view.setUint32(0x138, 12, true); view.setUint8(0x13c, 0x12); view.setUint16(0x13e, 2, true);
  return bytes;
}

let agent;
let agentBaseUrl;
test.before(async () => {
  configureSerialAdapter(virtualSerialAdapter);
  agent = startServer({ detectAi: false, restoreSerial: false, port: 0 });
  await once(agent, 'listening');
  const address = agent.address();
  assert.equal(typeof address, 'object');
  agentBaseUrl = `http://127.0.0.1:${address.port}`;
});
test.after(async () => {
  await new Promise(resolve => agent.close(resolve));
  configureSerialAdapter(null);
  configureFilePickerAdapter(null);
});

test('allows the development and deployed frontend origins', () => {
  assert.equal(isAllowedOrigin('http://localhost:3000'), true);
  assert.equal(isAllowedOrigin('https://sunsgn.github.io'), true);
  assert.equal(isAllowedOrigin('https://example.com'), false);
});

test('allows known loopback AI endpoints', () => {
  assert.equal(validateProxyTarget('http://localhost:11434/v1/chat/completions').port, '11434');
  assert.equal(validateProxyTarget('http://127.0.0.1:1234/v1/models').port, '1234');
});

test('rejects arbitrary, private-network, and credentialed targets', () => {
  assert.throws(() => validateProxyTarget('https://example.com/api'), /not allowed/);
  assert.throws(() => validateProxyTarget('http://192.168.1.10:11434/api'), /not allowed/);
  assert.throws(() => validateProxyTarget('http://user:secret@localhost:11434/api'), /credential-free/);
});

test('validates network debugging targets', () => {
  assert.deepEqual(validateHostAndPort('192.168.1.20', 9000), { host: '192.168.1.20', port: 9000 });
  assert.throws(() => validateHostAndPort('bad host', 9000), /Invalid target host/);
  assert.throws(() => validateHostAndPort('localhost', 70000), /between 1 and 65535/);
});

test('decodes text and HEX network payloads', () => {
  assert.equal(decodeNetworkPayload('hello', 'text').toString(), 'hello');
  assert.equal(decodeNetworkPayload('DE AD BE EF', 'hex').toString('hex'), 'deadbeef');
  assert.throws(() => decodeNetworkPayload('ABC', 'hex'), /Invalid HEX/);
});

test('creates shell-free build commands and confines build directories', () => {
  const rootPath = resolve(process.cwd());
  const command = createBuildCommand({ rootPath, system: 'cmake', action: 'build', buildDir: 'build', configuration: 'Release' });
  assert.equal(command.executable, 'cmake');
  assert.deepEqual(command.args.slice(0, 2), ['--build', resolve(rootPath, 'build')]);
  assert.ok(command.args.includes('Release'));
  assert.throws(() => createBuildCommand({ rootPath, system: 'cmake', buildDir: '..' }), /inside the project/);
});

test('parses GCC, Keil, IAR, and MSVC build diagnostics for source navigation', () => {
  assert.deepEqual(parseBuildDiagnostic('src/main.c:42:7: error: unknown identifier'), { file: 'src/main.c', line: 42, column: 7, severity: 'error', message: 'unknown identifier' });
  assert.deepEqual(parseBuildDiagnostic('Drivers\\uart.c(18): warning: #177-D: variable was declared but never referenced'), { file: 'Drivers\\uart.c', line: 18, column: 1, severity: 'warning', message: '#177-D: variable was declared but never referenced' });
  assert.deepEqual(parseBuildDiagnostic('"D:\\fw\\startup.c",123  column 9: Error[Pe020]: identifier is undefined'), { file: 'D:\\fw\\startup.c', line: 123, column: 9, severity: 'error', message: 'identifier is undefined' });
  assert.deepEqual(parseBuildDiagnostic('app.cpp(55,3): error C2065: undeclared identifier'), { file: 'app.cpp', line: 55, column: 3, severity: 'error', message: 'undeclared identifier' });
  assert.equal(parseBuildDiagnostic('region FLASH overflowed by 128 bytes'), null);
});

test('validates serial session settings', () => {
  assert.deepEqual(validateSerialOptions({ path: 'COM11', baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', dtr: false, rts: false }), { path: 'COM11', baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', dtr: false, rts: false, frameMode: 'auto', frameGapMs: 30 });
  assert.throws(() => validateSerialOptions({ path: '', baudRate: 115200 }), /Invalid serial port path/);
  assert.throws(() => validateSerialOptions({ path: 'COM11', baudRate: 0 }), /baud rate/);
});

test('groups byte-at-a-time serial input into complete lines', () => {
  const session = { frameMode: 'auto', frameGapMs: 30, rxBuffer: Buffer.alloc(0), rxTimer: null, events: [], lastEventId: 0, rxBytes: 0, txBytes: 0 };
  for (const byte of Buffer.from('[methane] start ok\r\n')) receiveSerialData(session, Buffer.from([byte]));
  assert.equal(session.events.length, 1);
  assert.equal(session.events[0].text, '[methane] start ok');
  assert.equal(session.rxBytes, Buffer.byteLength('[methane] start ok\r\n'));
  assert.equal(session.rxTimer, null);
});

test('flushes serial input without a line ending after the idle gap', async () => {
  const session = { frameMode: 'auto', frameGapMs: 5, rxBuffer: Buffer.alloc(0), rxTimer: null, events: [], lastEventId: 0, rxBytes: 0, txBytes: 0 };
  for (const byte of Buffer.from('tx ok socket=0 len=111')) receiveSerialData(session, Buffer.from([byte]));
  assert.equal(session.events.length, 0);
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(session.events.length, 1);
  assert.equal(session.events[0].text, 'tx ok socket=0 len=111');
  assert.equal(session.rxBytes, Buffer.byteLength('tx ok socket=0 len=111'));
});

test('lists serial ports through the local agent', async () => {
  const response = await fetch(`${agentBaseUrl}/api/serial/ports`);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(Array.isArray(result.ports));
  assert.equal(result.ports[0].path, 'VIRTUAL0');
});

test('runs a complete virtual serial session through the Local Agent API', async () => {
  const createdResponse = await fetch(`${agentBaseUrl}/api/serial/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: 'VIRTUAL0', baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', dtr: false, rts: false, frameMode: 'raw' }) });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.state, 'connected');

  const sendResponse = await fetch(`${agentBaseUrl}/api/serial/sessions/${created.id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ encoding: 'hex', data: 'DE AD BE EF' }) });
  assert.equal(sendResponse.status, 200);
  const current = await (await fetch(`${agentBaseUrl}/api/serial/sessions/${created.id}`)).json();
  assert.equal(current.txBytes, 4);
  assert.equal(current.rxBytes, 4);
  assert.ok(current.events.some(event => event.direction === 'tx' && event.hex === 'DE AD BE EF'));
  assert.ok(current.events.some(event => event.direction === 'rx' && event.hex === 'DE AD BE EF'));

  const signals = await fetch(`${agentBaseUrl}/api/serial/sessions/${created.id}/signals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dtr: true, rts: true }) });
  assert.equal(signals.status, 200);
  const config = await fetch(`${agentBaseUrl}/api/serial/sessions/${created.id}/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baudRate: 921600 }) });
  assert.equal(config.status, 200);
  assert.equal((await config.json()).baudRate, 921600);

  const closed = await fetch(`${agentBaseUrl}/api/serial/sessions/${created.id}`, { method: 'DELETE' });
  assert.equal(closed.status, 200);
});

test('reports local agent version and capabilities', async () => {
  const response = await fetch(`${agentBaseUrl}/api/agent/status`);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.version, '1.0.0');
  assert.equal(result.protocolVersion, 1);
  assert.ok(result.capabilities.includes('session-restore'));
  assert.ok(result.capabilities.includes('network-session-restore'));
  assert.ok(result.capabilities.includes('structured-errors'));
  assert.ok(result.capabilities.includes('project-build'));
  assert.ok(result.capabilities.includes('local-picker'));
  assert.ok(result.capabilities.includes('local-file-read'));
  assert.ok(result.capabilities.includes('elf-analysis'));
  assert.equal(response.headers.get('x-embedkit-protocol'), '1');
});

test('opens a controlled system picker and validates the selected path type', async () => {
  configureFilePickerAdapter({ select: async ({ kind }) => kind === 'directory' ? { path: process.cwd() } : { cancelled: true } });
  try {
    const selectedResponse = await fetch(`${agentBaseUrl}/api/files/select`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'directory', path: 'C:\\must-not-be-used' }) });
    assert.equal(selectedResponse.status, 200);
    const selected = await selectedResponse.json();
    assert.equal(selected.cancelled, false);
    assert.equal(selected.path, resolve(process.cwd()));
    assert.equal(selected.kind, 'directory');

    const cancelledResponse = await fetch(`${agentBaseUrl}/api/files/select`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'file' }) });
    assert.deepEqual(await cancelledResponse.json(), { cancelled: true, kind: 'file' });

    const invalidResponse = await fetch(`${agentBaseUrl}/api/files/select`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'device' }) });
    assert.equal(invalidResponse.status, 400);
    assert.equal((await invalidResponse.json()).code, 'INVALID_REQUEST');
  } finally { configureFilePickerAdapter(null); }
});

test('reads selected files only through bounded revocable selection tokens', async () => {
  const selectedPath = resolve(process.cwd(), 'package.json');
  configureFilePickerAdapter({ select: async () => ({ path: selectedPath }) });
  try {
    const selectedResponse = await fetch(`${agentBaseUrl}/api/files/select`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'file' }) });
    assert.equal(selectedResponse.status, 200);
    const selected = await selectedResponse.json();
    assert.ok(selected.selectionId);
    assert.equal(selected.path, selectedPath);

    const metadataResponse = await fetch(`${agentBaseUrl}/api/files/selections/${selected.selectionId}`);
    assert.equal(metadataResponse.status, 200);
    const metadata = await metadataResponse.json();
    assert.equal(metadata.name, 'package.json');
    assert.equal(metadata.path, undefined);

    const chunkResponse = await fetch(`${agentBaseUrl}/api/files/selections/${selected.selectionId}/chunk?offset=0&length=32`);
    assert.equal(chunkResponse.status, 200);
    const chunk = await chunkResponse.json();
    assert.equal(chunk.byteLength, 32);
    assert.match(Buffer.from(chunk.data, 'base64').toString('utf8'), /^\s*\{/);

    const oversized = await fetch(`${agentBaseUrl}/api/files/selections/${selected.selectionId}/chunk?length=${256 * 1024 + 1}`);
    assert.equal(oversized.status, 400);
    const nonElf = await fetch(`${agentBaseUrl}/api/elf/analyze/${selected.selectionId}`);
    assert.equal(nonElf.status, 400);
    assert.match((await nonElf.json()).message, /ELF signature/);
    const revoked = await fetch(`${agentBaseUrl}/api/files/selections/${selected.selectionId}`, { method: 'DELETE' });
    assert.deepEqual(await revoked.json(), { revoked: true });
    assert.equal((await fetch(`${agentBaseUrl}/api/files/selections/${selected.selectionId}`)).status, 400);
  } finally { configureFilePickerAdapter(null); }
});

test('analyzes authorized ELF symbols and resolves a Thumb fault address after revoking the file token', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'embedkit-elf-')), selectedPath = join(directory, 'app.axf');
  await writeFile(selectedPath, elfWithMainSymbol());
  configureFilePickerAdapter({ select: async () => ({ path: selectedPath }) });
  try {
    const selected = await (await fetch(`${agentBaseUrl}/api/files/select`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'file' }) })).json();
    const analyzedResponse = await fetch(`${agentBaseUrl}/api/elf/analyze/${selected.selectionId}`), analyzed = await analyzedResponse.json();
    assert.equal(analyzedResponse.status, 200); assert.equal(analyzed.namedSymbolCount, 1); assert.ok(analyzed.analysisId); assert.equal(analyzed.symbols, undefined);
    await fetch(`${agentBaseUrl}/api/files/selections/${selected.selectionId}`, { method: 'DELETE' });
    const lookupResponse = await fetch(`${agentBaseUrl}/api/elf/analyses/${analyzed.analysisId}/lookup?address=0x08000109`), lookup = await lookupResponse.json();
    assert.equal(lookupResponse.status, 200); assert.equal(lookup.match, 'inside-symbol'); assert.equal(lookup.symbol.name, 'main'); assert.equal(lookup.symbol.offset, '0x8'); assert.equal(lookup.thumbBitCleared, true);
    assert.equal((await fetch(`${agentBaseUrl}/api/elf/analyses/${analyzed.analysisId}/lookup?address=main%2B4`)).status, 400);
  } finally { configureFilePickerAdapter(null); await rm(directory, { recursive: true, force: true }); }
});

test('detects a local project build environment', async () => {
  const response = await fetch(`${agentBaseUrl}/api/build/detect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rootPath: resolve(process.cwd()) }) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.rootPath, resolve(process.cwd()));
  assert.ok(Array.isArray(result.tools));
});

test('runs and reports a build job lifecycle without invoking a shell', async () => {
  const createdResponse = await fetch(`${agentBaseUrl}/api/build/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rootPath: resolve(process.cwd()), system: 'cmake', action: 'build', toolPath: 'embedkit-tool-that-does-not-exist' }) });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  let current = created;
  for (let attempt = 0; attempt < 30 && current.state === 'running'; attempt += 1) { await new Promise(resolveWait => setTimeout(resolveWait, 20)); current = await (await fetch(`${agentBaseUrl}/api/build/jobs/${created.id}`)).json(); }
  assert.equal(current.state, 'failed');
  assert.ok(current.events.some(event => /does-not-exist|ENOENT/i.test(event.text)));
});

test('authorizes only unchanged artifacts discovered inside a completed build directory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'embedkit-build-artifact-')), artifactPath = join(directory, 'app.elf');
  try {
    await writeFile(artifactPath, elfWithMainSymbol()); const info = await stat(artifactPath);
    const job = { buildPath: directory, artifacts: [{ name: 'app.elf', path: artifactPath, type: 'elf', size: info.size, modifiedAt: info.mtime.toISOString() }] };
    const selected = await authorizeBuildArtifact(job, 0);
    assert.ok(selected.selectionId); assert.equal(selected.name, 'app.elf');
    const metadata = await (await fetch(`${agentBaseUrl}/api/files/selections/${selected.selectionId}`)).json();
    assert.equal(metadata.name, 'app.elf'); assert.equal(metadata.path, undefined);
    await writeFile(artifactPath, Buffer.concat([elfWithMainSymbol(), Buffer.from([0])]));
    await assert.rejects(authorizeBuildArtifact(job, 0), /changed after discovery/);
    await assert.rejects(authorizeBuildArtifact({ buildPath: directory, artifacts: [{ ...job.artifacts[0], path: resolve(directory, '..', 'outside.elf') }] }, 0), /outside/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('returns structured recoverable API errors', async () => {
  const response = await fetch(`${agentBaseUrl}/api/network/sessions/00000000-0000-0000-0000-000000000000`);
  assert.equal(response.status, 404);
  const result = await response.json();
  assert.equal(result.code, 'NOT_FOUND');
  assert.equal(result.message, 'Network session not found');
  assert.equal(result.error, result.message);
  assert.equal(result.recoverable, true);
});

test('lists active network sessions for UI restoration', async () => {
  const response = await fetch(`${agentBaseUrl}/api/network/sessions`);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(Array.isArray(result.sessions));
});

test('runs a real TCP loopback debugging session', async () => {
  const echoServer = net.createServer(socket => socket.pipe(socket));
  echoServer.listen(0, '127.0.0.1');
  await once(echoServer, 'listening');
  const echoAddress = echoServer.address();
  assert.equal(typeof echoAddress, 'object');

  try {
    const createdResponse = await fetch(`${agentBaseUrl}/api/network/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'tcp', host: '127.0.0.1', port: echoAddress.port }),
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();

    let current;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await fetch(`${agentBaseUrl}/api/network/sessions/${created.id}`);
      current = await response.json();
      if (current.state === 'connected') break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(current.state, 'connected');

    const sendResponse = await fetch(`${agentBaseUrl}/api/network/sessions/${created.id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encoding: 'hex', data: 'DE AD BE EF' }),
    });
    assert.equal(sendResponse.status, 200);

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await fetch(`${agentBaseUrl}/api/network/sessions/${created.id}`);
      current = await response.json();
      if (current.events.some(event => event.direction === 'rx')) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.ok(current.events.some(event => event.direction === 'tx' && event.hex === 'DE AD BE EF'));
    assert.ok(current.events.some(event => event.direction === 'rx' && event.hex === 'DE AD BE EF'));
    assert.equal(current.txBytes, 4);
    assert.equal(current.rxBytes, 4);
    await fetch(`${agentBaseUrl}/api/network/sessions/${created.id}`, { method: 'DELETE' });
  } finally {
    await new Promise(resolve => echoServer.close(resolve));
  }
});

test('runs a TCP server debugging session', async () => {
  const reservation = net.createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const reservedAddress = reservation.address(); assert.equal(typeof reservedAddress, 'object'); const listenPort = reservedAddress.port;
  await new Promise(resolve => reservation.close(resolve));
  const createdResponse = await fetch(`${agentBaseUrl}/api/network/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'tcp', mode: 'server', host: '127.0.0.1', port: listenPort }) });
  assert.equal(createdResponse.status, 201); const created = await createdResponse.json();
  let current;
  for (let attempt = 0; attempt < 30; attempt += 1) { current = await (await fetch(`${agentBaseUrl}/api/network/sessions/${created.id}`)).json(); if (current.state === 'connected') break; await new Promise(resolve => setTimeout(resolve, 20)); }
  assert.equal(current.mode, 'server'); assert.equal(current.state, 'connected');
  const client = net.createConnection({ host: '127.0.0.1', port: listenPort }); await once(client, 'connect'); client.write('from-client');
  for (let attempt = 0; attempt < 30; attempt += 1) { current = await (await fetch(`${agentBaseUrl}/api/network/sessions/${created.id}`)).json(); if (current.events.some(event => event.direction === 'rx')) break; await new Promise(resolve => setTimeout(resolve, 20)); }
  assert.ok(current.events.some(event => event.direction === 'rx' && event.text === 'from-client'));
  const reply = once(client, 'data'); const sent = await fetch(`${agentBaseUrl}/api/network/sessions/${created.id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ encoding: 'text', data: 'from-server' }) }); assert.equal(sent.status, 200); const [replyData] = await reply; assert.equal(replyData.toString(), 'from-server');
  client.destroy(); await fetch(`${agentBaseUrl}/api/network/sessions/${created.id}`, { method: 'DELETE' });
});

test('runs a real UDP loopback debugging session', async () => {
  const echoServer = dgram.createSocket('udp4');
  echoServer.on('message', (message, peer) => echoServer.send(message, peer.port, peer.address));
  echoServer.bind(0, '127.0.0.1');
  await once(echoServer, 'listening');
  const echoAddress = echoServer.address();

  try {
    const createdResponse = await fetch(`${agentBaseUrl}/api/network/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'udp', host: '127.0.0.1', port: echoAddress.port, localPort: 0 }),
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();

    let current;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await fetch(`${agentBaseUrl}/api/network/sessions/${created.id}`);
      current = await response.json();
      if (current.state === 'connected') break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(current.state, 'connected');

    const sendResponse = await fetch(`${agentBaseUrl}/api/network/sessions/${created.id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encoding: 'text', data: 'udp-echo' }),
    });
    assert.equal(sendResponse.status, 200);

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await fetch(`${agentBaseUrl}/api/network/sessions/${created.id}`);
      current = await response.json();
      if (current.events.some(event => event.direction === 'rx')) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.ok(current.events.some(event => event.direction === 'rx' && event.text === 'udp-echo'));
    assert.equal(current.rxBytes, 8);
    assert.equal(current.txBytes, 8);
    await fetch(`${agentBaseUrl}/api/network/sessions/${created.id}`, { method: 'DELETE' });
  } finally {
    await new Promise(resolve => echoServer.close(resolve));
  }
});

test('runs a UDP server debugging session and replies to the latest peer', async () => {
  const reservation = dgram.createSocket('udp4'); reservation.bind(0, '127.0.0.1'); await once(reservation, 'listening'); const listenPort = reservation.address().port; reservation.close(); await once(reservation, 'close');
  const createdResponse = await fetch(`${agentBaseUrl}/api/network/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'udp', mode: 'server', host: '127.0.0.1', port: listenPort }) });
  assert.equal(createdResponse.status, 201); const created = await createdResponse.json();
  let current;
  for (let attempt = 0; attempt < 30; attempt += 1) { current = await (await fetch(`${agentBaseUrl}/api/network/sessions/${created.id}`)).json(); if (current.state === 'connected') break; await new Promise(resolve => setTimeout(resolve, 20)); }
  assert.equal(current.mode, 'server'); assert.equal(current.state, 'connected');
  const client = dgram.createSocket('udp4'); client.send(Buffer.from('udp-client'), listenPort, '127.0.0.1');
  for (let attempt = 0; attempt < 30; attempt += 1) { current = await (await fetch(`${agentBaseUrl}/api/network/sessions/${created.id}`)).json(); if (current.events.some(event => event.direction === 'rx')) break; await new Promise(resolve => setTimeout(resolve, 20)); }
  assert.ok(current.events.some(event => event.direction === 'rx' && event.text === 'udp-client'));
  const reply = once(client, 'message'); const sent = await fetch(`${agentBaseUrl}/api/network/sessions/${created.id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ encoding: 'text', data: 'udp-server' }) }); assert.equal(sent.status, 200); const [replyData] = await reply; assert.equal(replyData.toString(), 'udp-server');
  client.close(); await once(client, 'close'); await fetch(`${agentBaseUrl}/api/network/sessions/${created.id}`, { method: 'DELETE' });
});
