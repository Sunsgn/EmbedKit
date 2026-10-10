export type IntegerRadix = 2 | 8 | 10 | 16;

export interface IntegerConversion {
  decimal: string;
  hex: string;
  binary: string;
  octal: string;
}

function formatSigned(value: bigint, prefix: string, radix: number, uppercase = false) {
  const magnitude = value < 0n ? -value : value;
  const digits = magnitude.toString(radix);
  return `${value < 0n ? '-' : ''}${prefix}${uppercase ? digits.toUpperCase() : digits}`;
}

export function parseInteger(value: string, radix: IntegerRadix): bigint {
  const input = value.trim().replaceAll('_', '');
  if (!input) throw new Error('请输入数值');
  const negative = input.startsWith('-');
  const unsigned = negative ? input.slice(1) : input;
  const prefix = unsigned.match(/^0([xob])/i)?.[1]?.toLowerCase();
  const prefixRadix = prefix ? { x: 16, o: 8, b: 2 }[prefix] : undefined;
  if (prefixRadix !== undefined && prefixRadix !== radix) throw new Error('输入与当前进制不匹配');
  const clean = prefixRadix === undefined ? unsigned : unsigned.slice(2);
  if (!clean || ![...clean].every(char => Number.parseInt(char, radix).toString(radix).toLowerCase() === char.toLowerCase())) throw new Error('输入与当前进制不匹配');
  let result = 0n;
  for (const char of clean.toLowerCase()) result = result * BigInt(radix) + BigInt(Number.parseInt(char, radix));
  return negative ? -result : result;
}

export function convertInteger(value: string, radix: IntegerRadix): IntegerConversion {
  const number = parseInteger(value, radix);
  return {
    decimal: number.toString(10),
    hex: formatSigned(number, '0x', 16, true),
    binary: formatSigned(number, '0b', 2),
    octal: formatSigned(number, '0o', 8),
  };
}
