import { contiguousAddressSegments, parseHexBytes, type AddressedDataSegment } from '../../utils/embeddedTools';

export interface SrecAnalysis { records: number; dataRecords: number; dataBytes: number; minAddress: number; maxAddress: number; startAddress?: number; countRecord?: number; binary: Uint8Array; dataTypes: string[]; segments: AddressedDataSegment[] }
const addressBytes: Record<string, number> = { S0: 2, S1: 2, S2: 3, S3: 4, S5: 2, S6: 3, S7: 4, S8: 3, S9: 2 };
function readBigEndian(bytes: Uint8Array) { let value = 0; for (const byte of bytes) value = value * 256 + byte; return value; }

export function parseSrec(content: string): SrecAnalysis {
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error('Motorola SREC 内容为空');
  const memory = new Map<number, number>(), types = new Set<string>();
  let records = 0, dataRecords = 0, startAddress: number | undefined, countRecord: number | undefined;
  for (const [index, line] of lines.entries()) {
    const type = line.slice(0, 2).toUpperCase(), width = addressBytes[type];
    if (width === undefined || !/^S[0-9]/i.test(type)) throw new Error(`第 ${index + 1} 行记录类型无效`);
    const bytes = parseHexBytes(line.slice(2));
    if (bytes.length < width + 2) throw new Error(`第 ${index + 1} 行长度不足`);
    const count = bytes[0];
    if (bytes.length !== count + 1) throw new Error(`第 ${index + 1} 行长度与计数字段不一致`);
    if ((Array.from(bytes).reduce((sum, byte) => sum + byte, 0) & 0xff) !== 0xff) throw new Error(`第 ${index + 1} 行校验和错误`);
    const address = readBigEndian(bytes.slice(1, 1 + width)), data = bytes.slice(1 + width, -1);
    records += 1;
    if (type === 'S1' || type === 'S2' || type === 'S3') {
      types.add(type); dataRecords += 1;
      for (let offset = 0; offset < data.length; offset += 1) { const target = address + offset, previous = memory.get(target); if (previous !== undefined && previous !== data[offset]) throw new Error(`第 ${index + 1} 行与已有数据在地址 0x${target.toString(16).toUpperCase()} 冲突`); memory.set(target, data[offset]); }
    } else if (type === 'S5' || type === 'S6') { if (data.length) throw new Error(`第 ${index + 1} 行计数记录不应包含数据`); countRecord = address; }
    else if (type === 'S7' || type === 'S8' || type === 'S9') { if (data.length) throw new Error(`第 ${index + 1} 行终止记录不应包含数据`); startAddress = address; }
  }
  if (countRecord !== undefined && countRecord !== dataRecords) throw new Error(`SREC 计数记录声明 ${countRecord} 条数据记录，实际 ${dataRecords} 条`);
  const addresses = [...memory.keys()].sort((a, b) => a - b), minAddress = addresses[0] ?? 0, maxAddress = addresses.at(-1) ?? 0, span = addresses.length ? maxAddress - minAddress + 1 : 0;
  if (span > 16 * 1024 * 1024) throw new Error('SREC 地址跨度超过 16 MiB，拒绝生成超大稀疏 BIN');
  const binary = new Uint8Array(span).fill(0xff); for (const [address, byte] of memory) binary[address - minAddress] = byte;
  return { records, dataRecords, dataBytes: memory.size, minAddress, maxAddress, startAddress, countRecord, binary, dataTypes: [...types].sort(), segments: contiguousAddressSegments(memory) };
}
