import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSerialAcceptanceArgs, serialAcceptancePayload, serialAcceptanceResult } from './serial-acceptance-core.js';

test('parses explicit real-device serial settings without selecting a port implicitly', () => {
  const options = parseSerialAcceptanceArgs(['--port', 'COM11', '--baud', '921600', '--hex', 'DE AD', '--expect', 'OK', '--dtr']);
  assert.equal(options.port, 'COM11');
  assert.equal(options.baudRate, 921600);
  assert.equal(options.encoding, 'hex');
  assert.equal(options.dtr, true);
  assert.throws(() => parseSerialAcceptanceArgs(['--send', 'AT']), /use --list first/);
});

test('validates payloads and creates a versioned evidence report', () => {
  assert.equal(serialAcceptancePayload('DE AD BE EF', 'hex').toString('hex'), 'deadbeef');
  assert.throws(() => serialAcceptancePayload('ABC', 'hex'), /byte pairs/);
  const options = parseSerialAcceptanceArgs(['--port', 'COM11', '--send', 'AT', '--expect', 'OK']);
  const report = serialAcceptanceResult(options, Buffer.from('AT\r\nOK\r\n'), '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.020Z');
  assert.equal(report.status, 'passed');
  assert.equal(report.response.bytes, 8);
  assert.equal(report.durationMs, 20);
  assert.equal(report.schemaVersion, 2);
  assert.equal(report.response.truncated, false);
});

test('bounds captured evidence and redacts credential-bearing requests', () => {
  const options = parseSerialAcceptanceArgs(['--port', 'COM11', '--send', 'AT+CWJAP="ssid","password"', '--redact-request', '--max-capture', '256']);
  const report = serialAcceptanceResult(options, Buffer.alloc(256, 0x41), '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z', 1024);
  assert.equal(report.request.data, '[REDACTED]');
  assert.equal(report.request.redacted, true);
  assert.equal(report.response.bytes, 1024);
  assert.equal(report.response.capturedBytes, 256);
  assert.equal(report.response.truncated, true);
  assert.throws(() => parseSerialAcceptanceArgs(['--port', 'COM11', '--max-capture', '10']), /Capture limit/);
});
