export function parseSerialAcceptanceArgs(values) {
  const options = { port: '', baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', dtr: false, rts: false, encoding: 'text', send: '', expect: '', timeoutMs: 5000, list: false, selfTest: false };
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (key === '--list') options.list = true;
    else if (key === '--self-test') options.selfTest = true;
    else if (key === '--dtr') options.dtr = true;
    else if (key === '--rts') options.rts = true;
    else {
      const value = values[++index];
      if (value === undefined) throw new Error(`Missing value for ${key}`);
      if (key === '--port') options.port = value;
      else if (key === '--baud') options.baudRate = Number(value);
      else if (key === '--data-bits') options.dataBits = Number(value);
      else if (key === '--stop-bits') options.stopBits = Number(value);
      else if (key === '--parity') options.parity = value;
      else if (key === '--send') options.send = value;
      else if (key === '--hex') { options.encoding = 'hex'; options.send = value; }
      else if (key === '--expect') options.expect = value;
      else if (key === '--timeout') options.timeoutMs = Number(value);
      else throw new Error(`Unknown option: ${key}`);
    }
  }
  if (!Number.isInteger(options.baudRate) || options.baudRate < 50 || options.baudRate > 12000000) throw new Error('Baud rate must be an integer between 50 and 12000000');
  if (![5, 6, 7, 8].includes(options.dataBits)) throw new Error('Data bits must be 5, 6, 7 or 8');
  if (![1, 1.5, 2].includes(options.stopBits)) throw new Error('Stop bits must be 1, 1.5 or 2');
  if (!['none', 'even', 'odd', 'mark', 'space'].includes(options.parity)) throw new Error('Invalid parity');
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 100 || options.timeoutMs > 300000) throw new Error('Timeout must be between 100 and 300000 ms');
  if (!options.list && !options.selfTest && !options.port) throw new Error('A serial port is required; use --list first');
  return options;
}

export function serialAcceptancePayload(value, encoding) {
  if (encoding === 'text') return Buffer.from(value, 'utf8');
  const normalized = value.replace(/0x/gi, '').replace(/[\s,;:_-]+/g, '');
  if (!normalized || !/^[0-9a-f]+$/i.test(normalized) || normalized.length % 2) throw new Error('HEX payload must contain complete byte pairs');
  return Buffer.from(normalized, 'hex');
}

export function serialAcceptanceResult(options, received, startedAt, finishedAt) {
  const text = received.toString('utf8'), expected = options.expect;
  return { schemaVersion: 1, kind: 'embedkit.serial-device-acceptance', status: expected ? text.includes(expected) ? 'passed' : 'failed' : received.length ? 'observed' : 'no-data', port: options.port, settings: { baudRate: options.baudRate, dataBits: options.dataBits, stopBits: options.stopBits, parity: options.parity, dtr: options.dtr, rts: options.rts }, request: { encoding: options.encoding, data: options.send, bytes: serialAcceptancePayload(options.send, options.encoding).length }, response: { text, hex: received.toString('hex').match(/.{1,2}/g)?.join(' ').toUpperCase() || '', bytes: received.length }, expectation: expected, startedAt, finishedAt, durationMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime() };
}
