import { SerialPort } from 'serialport';
import { parseSerialAcceptanceArgs, serialAcceptancePayload, serialAcceptanceResult } from './serial-acceptance-core.js';

const options = parseSerialAcceptanceArgs(process.argv.slice(2));
if (options.selfTest) {
  const result = serialAcceptanceResult({ ...options, port: 'SELFTEST', send: 'AT', expect: 'OK' }, Buffer.from('AT\r\nOK\r\n'), '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.010Z');
  if (result.status !== 'passed' || result.response.bytes !== 8) throw new Error('Serial acceptance self-test failed');
  console.log('Serial device acceptance runner self-test passed.');
  process.exit(0);
}
if (options.list) {
  console.log(JSON.stringify({ ports: await SerialPort.list() }, null, 2));
  process.exit(0);
}

const startedAt = new Date().toISOString(), received = [];
const port = new SerialPort({ path: options.port, baudRate: options.baudRate, dataBits: options.dataBits, stopBits: options.stopBits, parity: options.parity, autoOpen: false });
try {
  await new Promise((resolve, reject) => port.open(error => error ? reject(error) : resolve()));
  await new Promise((resolve, reject) => port.set({ dtr: options.dtr, rts: options.rts }, error => error ? reject(error) : resolve()));
  port.on('data', data => received.push(Buffer.from(data)));
  const payload = serialAcceptancePayload(options.send, options.encoding);
  if (payload.length) await new Promise((resolve, reject) => port.write(payload, error => error ? reject(error) : port.drain(drainError => drainError ? reject(drainError) : resolve())));
  await new Promise(resolve => setTimeout(resolve, options.timeoutMs));
  const report = serialAcceptanceResult(options, Buffer.concat(received), startedAt, new Date().toISOString());
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status === 'failed' || report.status === 'no-data' ? 1 : 0;
} finally {
  if (port.isOpen) await new Promise(resolve => port.close(() => resolve()));
}
