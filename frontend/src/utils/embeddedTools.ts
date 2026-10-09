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
