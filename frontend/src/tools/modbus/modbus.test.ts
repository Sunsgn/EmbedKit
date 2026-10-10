import { describe, expect, it } from 'vitest';
import { buildModbusRequest, parseModbusResponse } from './modbus';

describe('Modbus RTU/TCP tool domain', () => {
  it('matches the standard RTU read holding registers request', () => {
    expect(buildModbusRequest({ transport: 'rtu', operation: 'read-holding', unitId: 1, address: 0, value: 2 }).hex).toBe('01 03 00 00 00 02 C4 0B');
  });
  it('builds the equivalent TCP request with a valid MBAP header', () => {
    expect(buildModbusRequest({ transport: 'tcp', operation: 'read-holding', unitId: 1, address: 0, value: 2, transactionId: 1 }).hex).toBe('00 01 00 00 00 06 01 03 00 00 00 02');
  });
  it('parses normal and exception TCP responses', () => {
    expect(parseModbusResponse('00 01 00 00 00 07 01 03 04 00 0A 01 02', 'tcp')).toMatchObject({ transactionId: 1, unitId: 1, functionCode: 3, data: Uint8Array.from([0, 10, 1, 2]) });
    expect(parseModbusResponse('00 02 00 00 00 03 01 83 02', 'tcp')).toMatchObject({ exceptionCode: 2, exception: '非法数据地址' });
  });
  it('validates CRC, MBAP length and operation ranges', () => {
    expect(() => parseModbusResponse('01 03 04 00 0A 01 02 00 00', 'rtu')).toThrow('CRC');
    expect(() => parseModbusResponse('00 01 00 00 00 06 01 03 02 00 01', 'tcp')).toThrow('MBAP 长度');
    expect(() => buildModbusRequest({ transport: 'rtu', operation: 'read-holding', unitId: 1, address: 0, value: 126 })).toThrow('1 到 125');
    expect(() => buildModbusRequest({ transport: 'rtu', operation: 'write-coil', unitId: 1, address: 0, value: 2 })).toThrow('0 或 1');
  });
});
