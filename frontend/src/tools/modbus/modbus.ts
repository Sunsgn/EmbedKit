import { crc16Modbus, formatHex, parseHexBytes } from '../../utils/embeddedTools';

export type ModbusTransport = 'rtu' | 'tcp';
export type ModbusOperation = 'read-coils' | 'read-discrete' | 'read-holding' | 'read-input' | 'write-coil' | 'write-register';

const functionCodes: Record<ModbusOperation, number> = { 'read-coils': 1, 'read-discrete': 2, 'read-holding': 3, 'read-input': 4, 'write-coil': 5, 'write-register': 6 };
const exceptionNames: Record<number, string> = { 1: '非法功能', 2: '非法数据地址', 3: '非法数据值', 4: '从站设备故障', 5: '确认', 6: '从站设备忙', 8: '存储奇偶校验错误', 10: '网关路径不可用', 11: '网关目标设备无响应' };

export interface ModbusRequest { transport: ModbusTransport; operation: ModbusOperation; unitId: number; address: number; value: number; transactionId?: number }
export interface ModbusFrame { bytes: Uint8Array; hex: string; functionCode: number }
export interface ModbusResponse { transport: ModbusTransport; transactionId?: number; unitId: number; functionCode: number; exceptionCode?: number; exception?: string; data: Uint8Array; address?: number; value?: number }

function uint16(value: number, label: string) { if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new Error(`${label}必须是 0 到 65535 的整数`); return [value >>> 8, value & 0xff]; }
function wrapFrame(transport: ModbusTransport, unitId: number, pdu: number[], transactionId = 0) {
  if (!Number.isInteger(unitId) || unitId < 0 || unitId > (transport === 'rtu' ? 247 : 255)) throw new Error(transport === 'rtu' ? 'RTU 从站地址必须是 0 到 247 的整数' : 'TCP 单元标识必须是 0 到 255 的整数');
  if (transport === 'rtu') { const body = Uint8Array.from([unitId, ...pdu]); const crc = crc16Modbus(body); return Uint8Array.from([...body, crc & 0xff, crc >>> 8]); }
  const tx = uint16(transactionId, '事务标识');
  return Uint8Array.from([...tx, 0, 0, 0, pdu.length + 1, unitId, ...pdu]);
}

export function buildModbusRequest(input: ModbusRequest): ModbusFrame {
  const functionCode = functionCodes[input.operation];
  const address = uint16(input.address, '起始地址');
  let encodedValue: number[];
  if (functionCode <= 4) {
    const limit = functionCode <= 2 ? 2000 : 125;
    if (!Number.isInteger(input.value) || input.value < 1 || input.value > limit) throw new Error(`读取数量必须是 1 到 ${limit} 的整数`);
    encodedValue = uint16(input.value, '读取数量');
  } else if (functionCode === 5) {
    if (input.value !== 0 && input.value !== 1) throw new Error('线圈写入值必须是 0 或 1');
    encodedValue = input.value ? [0xff, 0] : [0, 0];
  } else encodedValue = uint16(input.value, '寄存器写入值');
  const bytes = wrapFrame(input.transport, input.unitId, [functionCode, ...address, ...encodedValue], input.transactionId);
  return { bytes, hex: formatHex(bytes), functionCode };
}

export function parseModbusResponse(value: string, transport: ModbusTransport): ModbusResponse {
  const frame = parseHexBytes(value);
  let transactionId: number | undefined, unitId: number, pdu: Uint8Array;
  if (transport === 'rtu') {
    if (frame.length < 5) throw new Error('Modbus RTU 响应至少需要 5 字节');
    const content = frame.slice(0, -2), received = frame.at(-2)! | (frame.at(-1)! << 8);
    if (crc16Modbus(content) !== received) throw new Error('Modbus RTU CRC 校验失败');
    unitId = content[0]; pdu = content.slice(1);
  } else {
    if (frame.length < 8) throw new Error('Modbus TCP 响应至少需要 8 字节');
    transactionId = frame[0] * 256 + frame[1];
    if (frame[2] !== 0 || frame[3] !== 0) throw new Error('Modbus TCP 协议标识必须为 0');
    const length = frame[4] * 256 + frame[5];
    if (length !== frame.length - 6) throw new Error('Modbus TCP MBAP 长度与帧长度不一致');
    unitId = frame[6]; pdu = frame.slice(7);
  }
  const functionCode = pdu[0];
  if ((functionCode & 0x80) !== 0) { const exceptionCode = pdu[1]; if (pdu.length !== 2) throw new Error('Modbus 异常响应长度无效'); return { transport, transactionId, unitId, functionCode, exceptionCode, exception: exceptionNames[exceptionCode] ?? `未知异常 0x${exceptionCode.toString(16).padStart(2, '0').toUpperCase()}`, data: new Uint8Array() }; }
  if (functionCode >= 1 && functionCode <= 4) { const count = pdu[1]; if (pdu.length !== count + 2) throw new Error('Modbus 响应字节计数与数据长度不一致'); return { transport, transactionId, unitId, functionCode, data: pdu.slice(2) }; }
  if (functionCode === 5 || functionCode === 6) { if (pdu.length !== 5) throw new Error('Modbus 写入响应长度无效'); return { transport, transactionId, unitId, functionCode, address: pdu[1] * 256 + pdu[2], value: pdu[3] * 256 + pdu[4], data: new Uint8Array() }; }
  throw new Error(`暂不支持响应功能码 0x${functionCode.toString(16).padStart(2, '0').toUpperCase()}`);
}
