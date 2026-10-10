import { crc32 } from '../../utils/embeddedTools';

export interface FirmwareSegment { name: string; address: number; bytes: Uint8Array }
export type OverlapPolicy = 'reject' | 'keep-first' | 'keep-last';
export interface FirmwareDifference { startAddress: number; endAddress: number; changedBytes: number }
function address(value: number, label: string) { if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new Error(`${label}必须是 0 到 0xFFFFFFFF 的整数`); return value; }

export function mergeFirmware(segments: FirmwareSegment[], policy: OverlapPolicy = 'reject', fill = 0xff) {
  if (!segments.length || segments.every(item => item.bytes.length === 0)) throw new Error('至少需要一个非空固件分段');
  if (!Number.isInteger(fill) || fill < 0 || fill > 255) throw new Error('填充值必须是 0 到 255 的整数');
  const normalized = segments.filter(item => item.bytes.length > 0).map(item => { const start = address(item.address, `${item.name || '分段'} 基地址`); if (start + item.bytes.length - 1 > 0xffffffff) throw new Error(`${item.name || '分段'} 超出 32 位地址空间`); return { ...item, address: start }; });
  const baseAddress = Math.min(...normalized.map(item => item.address)), endAddress = Math.max(...normalized.map(item => item.address + Math.max(0, item.bytes.length - 1)));
  const span = endAddress - baseAddress + 1;
  if (span > 32 * 1024 * 1024) throw new Error('合并地址跨度超过 32 MiB');
  const bytes = new Uint8Array(span).fill(fill), occupied = new Uint8Array(span), overlaps: Array<{ address: number; previous: string; incoming: string }> = [], owner = new Map<number, string>();
  for (const segment of normalized) for (let offset = 0; offset < segment.bytes.length; offset += 1) { const index = segment.address - baseAddress + offset, absolute = segment.address + offset; if (occupied[index]) { overlaps.push({ address: absolute, previous: owner.get(index) ?? '', incoming: segment.name }); if (policy === 'reject' && bytes[index] !== segment.bytes[offset]) throw new Error(`固件分段在地址 0x${absolute.toString(16).toUpperCase()} 发生冲突`); if (policy === 'keep-first') continue; } bytes[index] = segment.bytes[offset]; occupied[index] = 1; owner.set(index, segment.name); }
  return { baseAddress, endAddress, bytes, overlaps, crc32: crc32(bytes) };
}

export function compareFirmware(left: Uint8Array, leftAddress: number, right: Uint8Array, rightAddress: number) {
  address(leftAddress, '左侧基地址'); address(rightAddress, '右侧基地址');
  const start = Math.min(leftAddress, rightAddress), end = Math.max(leftAddress + left.length, rightAddress + right.length), differences: FirmwareDifference[] = [];
  if (end - start > 32 * 1024 * 1024) throw new Error('比较地址跨度超过 32 MiB');
  let current: FirmwareDifference | null = null, changedBytes = 0;
  for (let absolute = start; absolute < end; absolute += 1) { const li = absolute - leftAddress, ri = absolute - rightAddress, lv = li >= 0 && li < left.length ? left[li] : undefined, rv = ri >= 0 && ri < right.length ? right[ri] : undefined; if (lv !== rv) { changedBytes += 1; if (!current) current = { startAddress: absolute, endAddress: absolute, changedBytes: 1 }; else { current.endAddress = absolute; current.changedBytes += 1; } } else if (current) { differences.push(current); current = null; } }
  if (current) differences.push(current);
  return { identical: changedBytes === 0, changedBytes, differences, leftCrc32: crc32(left), rightCrc32: crc32(right) };
}
