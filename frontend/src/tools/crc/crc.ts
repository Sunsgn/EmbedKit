import { crc16Modbus, crc32, formatHex, parseHexBytes, swapEndian } from '../../utils/embeddedTools';

export type CrcInputMode = 'hex' | 'text';

export function calculateCrcSummary(value: string, mode: CrcInputMode) {
  const bytes = mode === 'hex' ? parseHexBytes(value) : new TextEncoder().encode(value);
  const modbus = crc16Modbus(bytes);
  return {
    length: String(bytes.length),
    crc16: `0x${modbus.toString(16).padStart(4, '0').toUpperCase()}`,
    wire: `${(modbus & 0xff).toString(16).padStart(2, '0').toUpperCase()} ${(modbus >>> 8).toString(16).padStart(2, '0').toUpperCase()}`,
    crc32: `0x${crc32(bytes).toString(16).padStart(8, '0').toUpperCase()}`,
    reverse: formatHex(swapEndian(bytes)),
  };
}
