import { crc16Modbus, crc32, formatHex, parseHexBytes, swapEndian } from '../../utils/embeddedTools';

export type CrcInputMode = 'hex' | 'text';

export interface CrcParameters {
  name: string;
  width: number;
  polynomial: number;
  initial: number;
  reflectInput: boolean;
  reflectOutput: boolean;
  xorOutput: number;
}

export const CRC_PRESETS: Record<string, CrcParameters> = {
  'crc16-modbus': { name: 'CRC-16/MODBUS', width: 16, polynomial: 0x8005, initial: 0xffff, reflectInput: true, reflectOutput: true, xorOutput: 0 },
  'crc16-ccitt-false': { name: 'CRC-16/CCITT-FALSE', width: 16, polynomial: 0x1021, initial: 0xffff, reflectInput: false, reflectOutput: false, xorOutput: 0 },
  'crc32-iso-hdlc': { name: 'CRC-32/ISO-HDLC', width: 32, polynomial: 0x04c11db7, initial: 0xffffffff, reflectInput: true, reflectOutput: true, xorOutput: 0xffffffff },
};

const widthMask = (width: number) => width === 32 ? 0xffffffff : 2 ** width - 1;
function reflect(value: number, width: number) {
  let result = 0;
  for (let bit = 0; bit < width; bit += 1) { result = result * 2 + (value & 1); value = Math.floor(value / 2); }
  return result >>> 0;
}

export function parseCrcParameter(value: string, label: string) {
  const normalized = value.trim().replace(/^0x/i, '');
  if (!/^[0-9a-f]+$/i.test(normalized)) throw new Error(`${label}必须是十六进制整数`);
  const parsed = Number.parseInt(normalized, 16);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label}超出有效范围`);
  return parsed;
}

export function calculateParameterizedCrc(bytes: Uint8Array, parameters: CrcParameters): number {
  const { width } = parameters;
  if (!Number.isInteger(width) || width < 8 || width > 32) throw new Error('CRC 位宽必须是 8 到 32');
  const mask = widthMask(width);
  if ([parameters.polynomial, parameters.initial, parameters.xorOutput].some(value => !Number.isInteger(value) || value < 0 || value > mask)) throw new Error(`CRC 参数必须位于 0 到 0x${mask.toString(16).toUpperCase()}`);
  let crc = parameters.initial >>> 0;
  if (parameters.reflectInput) {
    const reflectedPolynomial = reflect(parameters.polynomial, width);
    for (const byte of bytes) { crc = (crc ^ byte) >>> 0; for (let bit = 0; bit < 8; bit += 1) crc = ((crc & 1) ? (crc >>> 1) ^ reflectedPolynomial : crc >>> 1) >>> 0; }
  } else {
    const topBit = 2 ** (width - 1);
    for (const byte of bytes) { crc = (crc ^ byte * 2 ** (width - 8)) >>> 0; for (let bit = 0; bit < 8; bit += 1) crc = ((crc & topBit) ? crc * 2 ^ parameters.polynomial : crc * 2) >>> 0 & mask; }
  }
  if (parameters.reflectOutput !== parameters.reflectInput) crc = reflect(crc, width);
  const result = (crc ^ parameters.xorOutput) >>> 0;
  return width === 32 ? result : result & mask;
}

function inputBytes(value: string, mode: CrcInputMode) { return mode === 'hex' ? parseHexBytes(value) : new TextEncoder().encode(value); }
export function calculateCrcRange(value: string, mode: CrcInputMode, parameters: CrcParameters, start = 0, end?: number) {
  const allBytes = inputBytes(value, mode);
  const last = end === undefined ? allBytes.length : end;
  if (!Number.isInteger(start) || !Number.isInteger(last) || start < 0 || last < start || last > allBytes.length) throw new Error(`校验范围必须在 0 到 ${allBytes.length} 字节内，结束偏移不包含在内`);
  const bytes = allBytes.slice(start, last), result = calculateParameterizedCrc(bytes, parameters), digits = Math.ceil(parameters.width / 4);
  const hex = result.toString(16).padStart(digits, '0').toUpperCase(), resultBytes = Uint8Array.from({ length: Math.ceil(parameters.width / 8) }, (_, index) => result >>> ((Math.ceil(parameters.width / 8) - index - 1) * 8) & 0xff);
  return { totalLength: allBytes.length, checkedLength: bytes.length, start, end: last, result, hex: `0x${hex}`, wireBigEndian: formatHex(resultBytes), wireLittleEndian: formatHex(Uint8Array.from(resultBytes).reverse()) };
}

export function calculateCrcBatch(source: string, mode: CrcInputMode, parameters: CrcParameters) {
  const rows = source.split(/\r?\n/).map((value, index) => ({ value: value.trim(), line: index + 1 })).filter(row => row.value);
  if (rows.length > 500) throw new Error('批量模式最多处理 500 帧');
  return rows.map(row => { try { return { line: row.line, input: row.value, result: calculateCrcRange(row.value, mode, parameters), error: '' }; } catch (reason) { return { line: row.line, input: row.value, result: null, error: reason instanceof Error ? reason.message : String(reason) }; } });
}

export function generateCrcC(parameters: CrcParameters) {
  const digits = Math.ceil(parameters.width / 4), mask = widthMask(parameters.width), poly = parameters.reflectInput ? reflect(parameters.polynomial, parameters.width) : parameters.polynomial;
  const reflectOutput = parameters.reflectInput === parameters.reflectOutput ? '' : `\n    uint32_t reflected = 0u;\n    for (uint8_t bit = 0; bit < ${parameters.width}; ++bit) {\n        reflected = (reflected << 1) | (crc & 1u);\n        crc >>= 1;\n    }\n    crc = reflected;`;
  return `/* ${parameters.name}; poly=0x${parameters.polynomial.toString(16).toUpperCase().padStart(digits, '0')}, init=0x${parameters.initial.toString(16).toUpperCase().padStart(digits, '0')}, refin=${parameters.reflectInput}, refout=${parameters.reflectOutput}, xorout=0x${parameters.xorOutput.toString(16).toUpperCase().padStart(digits, '0')} */\nuint32_t crc_compute(const uint8_t *data, size_t length)\n{\n    uint32_t crc = 0x${parameters.initial.toString(16).toUpperCase().padStart(digits, '0')}u;\n    while (length--) {\n        crc ^= (uint32_t)(*data++)${parameters.reflectInput ? '' : ` << ${parameters.width - 8}`};\n        for (uint8_t bit = 0; bit < 8; ++bit)\n            crc = ${parameters.reflectInput ? `(crc & 1u) ? (crc >> 1) ^ 0x${poly.toString(16).toUpperCase()}u : crc >> 1` : `(crc & 0x${(2 ** (parameters.width - 1)).toString(16).toUpperCase()}u) ? (crc << 1) ^ 0x${poly.toString(16).toUpperCase()}u : crc << 1`};\n    }${reflectOutput}\n    return (crc ^ 0x${parameters.xorOutput.toString(16).toUpperCase()}u) & 0x${mask.toString(16).toUpperCase()}u;\n}`;
}

export function calculateCrcSummary(value: string, mode: CrcInputMode) {
  const bytes = inputBytes(value, mode);
  const modbus = crc16Modbus(bytes);
  return {
    length: String(bytes.length),
    crc16: `0x${modbus.toString(16).padStart(4, '0').toUpperCase()}`,
    wire: `${(modbus & 0xff).toString(16).padStart(2, '0').toUpperCase()} ${(modbus >>> 8).toString(16).padStart(2, '0').toUpperCase()}`,
    crc32: `0x${crc32(bytes).toString(16).padStart(8, '0').toUpperCase()}`,
    reverse: formatHex(swapEndian(bytes)),
  };
}
