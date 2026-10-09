export function parseHexBytes(value: string): Uint8Array {
  const normalized = value.replace(/0x/gi, '').replace(/[\s,;:_-]+/g, '');
  if (!normalized) return new Uint8Array();
  if (!/^[0-9a-f]+$/i.test(normalized) || normalized.length % 2 !== 0) throw new Error('HEX 数据必须由成对的 0-9 / A-F 字符组成');
  return Uint8Array.from(normalized.match(/.{2}/g)!.map(byte => Number.parseInt(byte, 16)));
}

export function formatHex(bytes: Uint8Array | number[]): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

export function crc16Modbus(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) !== 0 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
  }
  return crc & 0xffff;
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) !== 0 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function swapEndian(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(bytes).reverse();
}

export function parseInteger(value: string, radix: number): bigint {
  const input = value.trim().replaceAll('_', '');
  if (!input) throw new Error('请输入数值');
  const negative = input.startsWith('-');
  const unsigned = negative ? input.slice(1) : input;
  const clean = unsigned.replace(/^0[xob]/i, '');
  if (!clean || ![...clean].every(char => Number.parseInt(char, radix).toString(radix).toLowerCase() === char.toLowerCase())) throw new Error('输入与当前进制不匹配');
  let result = 0n;
  for (const char of clean.toLowerCase()) result = result * BigInt(radix) + BigInt(Number.parseInt(char, radix));
  return negative ? -result : result;
}

export function float32Representations(value: number): { hex: string; binary: string; bytesLE: string; bytesBE: string } {
  if (!Number.isFinite(value)) throw new Error('请输入有限数值');
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, value, false);
  const bytes = new Uint8Array(buffer);
  const integer = view.getUint32(0, false);
  return { hex: `0x${integer.toString(16).padStart(8, '0').toUpperCase()}`, binary: integer.toString(2).padStart(32, '0'), bytesBE: formatHex(bytes), bytesLE: formatHex(Uint8Array.from(bytes).reverse()) };
}

export function analyzeCanFrame(idValue: string, extended: boolean, dataValue: string, bitRate = 500000) {
  const normalized = idValue.trim().replace(/^0x/i, '');
  if (!/^[0-9a-f]+$/i.test(normalized)) throw new Error('CAN ID 必须是十六进制数');
  const id = Number.parseInt(normalized, 16), limit = extended ? 0x1fffffff : 0x7ff;
  if (id > limit) throw new Error(extended ? '扩展帧 ID 不能超过 0x1FFFFFFF' : '标准帧 ID 不能超过 0x7FF');
  const data = parseHexBytes(dataValue);
  if (data.length > 8) throw new Error('经典 CAN 数据长度不能超过 8 字节');
  if (!Number.isFinite(bitRate) || bitRate <= 0) throw new Error('CAN 波特率必须大于 0');
  const baseBits = (extended ? 67 : 47) + data.length * 8;
  const stuffableBits = (extended ? 54 : 34) + data.length * 8;
  const worstCaseBits = baseBits + Math.floor((stuffableBits - 1) / 4);
  return { id, idHex: `0x${id.toString(16).toUpperCase().padStart(extended ? 8 : 3, '0')}`, extended, dlc: data.length, data, baseBits, worstCaseBits, durationUs: baseBits / bitRate * 1e6, worstDurationUs: worstCaseBits / bitRate * 1e6 };
}

export function calculateTimerPwm(timerClockHz: number, prescaler: number, autoReload: number, compare: number) {
  if (!Number.isFinite(timerClockHz) || timerClockHz <= 0) throw new Error('定时器时钟必须大于 0');
  if (![prescaler, autoReload, compare].every(Number.isInteger) || prescaler < 0 || autoReload < 0 || compare < 0) throw new Error('PSC、ARR 和 CCR 必须是非负整数');
  if (compare > autoReload + 1) throw new Error('CCR 不能超过 ARR + 1');
  const counterClockHz = timerClockHz / (prescaler + 1), frequencyHz = counterClockHz / (autoReload + 1);
  return { counterClockHz, frequencyHz, periodUs: 1e6 / frequencyHz, dutyPercent: compare / (autoReload + 1) * 100, resolutionNs: 1e9 / counterClockHz };
}

export function calculateAdc(bits: number, referenceVoltage: number, raw: number, resistorTop = 0, resistorBottom = 1) {
  if (!Number.isInteger(bits) || bits < 1 || bits > 32) throw new Error('ADC 位数必须在 1 到 32 之间');
  if (!Number.isFinite(referenceVoltage) || referenceVoltage <= 0) throw new Error('参考电压必须大于 0');
  const maxCode = 2 ** bits - 1;
  if (!Number.isInteger(raw) || raw < 0 || raw > maxCode) throw new Error(`ADC 原始值必须在 0 到 ${maxCode} 之间`);
  if (![resistorTop, resistorBottom].every(Number.isFinite) || resistorTop < 0 || resistorBottom <= 0) throw new Error('分压电阻必须有效且下拉电阻大于 0');
  const pinVoltage = raw / maxCode * referenceVoltage;
  return { maxCode, lsbVoltage: referenceVoltage / maxCode, pinVoltage, sourceVoltage: pinVoltage * (resistorTop + resistorBottom) / resistorBottom, percent: raw / maxCode * 100 };
}

export interface IntelHexAnalysis { records: number; dataRecords: number; dataBytes: number; minAddress: number; maxAddress: number; startAddress?: number; eof: boolean; binary: Uint8Array }

export function parseIntelHex(content: string): IntelHexAnalysis {
  const memory = new Map<number, number>();
  let upperAddress = 0, records = 0, dataRecords = 0, eof = false, startAddress: number | undefined;
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error('Intel HEX 内容为空');
  for (const [index, line] of lines.entries()) {
    if (!line.startsWith(':')) throw new Error(`第 ${index + 1} 行缺少冒号`);
    const bytes = parseHexBytes(line.slice(1));
    if (bytes.length < 5 || bytes.length !== bytes[0] + 5) throw new Error(`第 ${index + 1} 行长度与记录声明不一致`);
    if (Array.from(bytes).reduce((sum, byte) => sum + byte, 0) % 256 !== 0) throw new Error(`第 ${index + 1} 行校验和错误`);
    const count = bytes[0], address = bytes[1] * 256 + bytes[2], type = bytes[3], data = bytes.slice(4, 4 + count);
    records += 1;
    if (type === 0x00) { dataRecords += 1; for (let offset = 0; offset < data.length; offset += 1) memory.set(upperAddress + address + offset, data[offset]); }
    else if (type === 0x01) eof = true;
    else if (type === 0x02) { if (data.length !== 2) throw new Error(`第 ${index + 1} 行扩展段地址长度错误`); upperAddress = (data[0] * 256 + data[1]) << 4; }
    else if (type === 0x04) { if (data.length !== 2) throw new Error(`第 ${index + 1} 行扩展线性地址长度错误`); upperAddress = (data[0] * 256 + data[1]) * 0x10000; }
    else if (type === 0x05) { if (data.length !== 4) throw new Error(`第 ${index + 1} 行启动地址长度错误`); startAddress = data[0] * 0x1000000 + data[1] * 0x10000 + data[2] * 0x100 + data[3]; }
  }
  const addresses = [...memory.keys()].sort((a, b) => a - b), minAddress = addresses[0] ?? 0, maxAddress = addresses.at(-1) ?? 0;
  const span = addresses.length ? maxAddress - minAddress + 1 : 0;
  if (span > 16 * 1024 * 1024) throw new Error('Intel HEX 地址跨度超过 16 MiB，拒绝生成超大稀疏 BIN');
  const binary = new Uint8Array(span).fill(0xff);
  for (const [address, byte] of memory) binary[address - minAddress] = byte;
  return { records, dataRecords, dataBytes: memory.size, minAddress, maxAddress, startAddress, eof, binary };
}

export function analyzeBinary(bytes: Uint8Array) {
  let zeroBytes = 0, erasedBytes = 0;
  for (const byte of bytes) { if (byte === 0) zeroBytes += 1; if (byte === 0xff) erasedBytes += 1; }
  return { size: bytes.length, crc32: crc32(bytes), zeroBytes, erasedBytes, head: bytes.slice(0, 32), tail: bytes.slice(Math.max(0, bytes.length - 16)) };
}
