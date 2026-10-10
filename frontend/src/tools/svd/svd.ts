export interface SvdField { name: string; description: string; bitOffset: number; bitWidth: number; mask: number }
export interface SvdRegister { id: string; peripheral: string; name: string; description: string; address: number; offset: number; size: number; access: string; resetValue?: number; fields: SvdField[] }
export interface SvdPeripheral { name: string; description: string; baseAddress: number; registers: SvdRegister[] }
export interface SvdDevice { name: string; description: string; peripherals: SvdPeripheral[]; registerCount: number; fieldCount: number; warnings: string[] }

const text = (node: Element, selector: string) => node.querySelector(`:scope > ${selector}`)?.textContent?.trim() ?? '';
function numberValue(value: string, fallback?: number) { if (!value) { if (fallback !== undefined) return fallback; throw new Error('缺少数值字段'); } const normalized = value.replaceAll('_', '').replace(/^#/, '0b'); const parsed = Number(normalized); if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) throw new Error(`无效数值 ${value}`); return parsed; }
function accessValue(register: Element, peripheral: Element) { return text(register, 'access') || text(peripheral, 'access') || '未声明'; }
function fieldBits(field: Element) {
  const offset = text(field, 'bitOffset'), width = text(field, 'bitWidth'), lsb = text(field, 'lsb'), msb = text(field, 'msb'), range = text(field, 'bitRange').match(/^\[(\d+):(\d+)\]$/);
  if (offset && width) return { bitOffset: numberValue(offset), bitWidth: numberValue(width) };
  if (lsb && msb) { const low = numberValue(lsb), high = numberValue(msb); return { bitOffset: low, bitWidth: high - low + 1 }; }
  if (range) { const high = Number(range[1]), low = Number(range[2]); return { bitOffset: low, bitWidth: high - low + 1 }; }
  throw new Error(`字段 ${text(field, 'name') || '未命名'} 缺少位范围`);
}
function expandIndices(register: Element) { const dim = numberValue(text(register, 'dim'), 1); if (dim > 4096) throw new Error(`寄存器 ${text(register, 'name')} 数组维度超过 4096`); const raw = text(register, 'dimIndex'); if (!raw) return Array.from({ length: dim }, (_, index) => String(index)); const range = raw.match(/^(\d+)-(\d+)$/); if (range) return Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, index) => String(Number(range[1]) + index)); return raw.split(',').map(item => item.trim()).filter(Boolean); }

export function parseSvd(source: string): SvdDevice {
  if (source.length > 10 * 1024 * 1024) throw new Error('SVD 文件超过 10 MiB 浏览器解析上限');
  const document = new DOMParser().parseFromString(source, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('SVD XML 格式错误');
  const device = document.querySelector('device'); if (!device) throw new Error('未找到 CMSIS-SVD device 根节点');
  const warnings: string[] = [], peripherals: SvdPeripheral[] = [];
  for (const peripheral of device.querySelectorAll(':scope > peripherals > peripheral')) {
    const name = text(peripheral, 'name'); if (!name) { warnings.push('跳过未命名外设'); continue; }
    let baseAddress: number; try { baseAddress = numberValue(text(peripheral, 'baseAddress')); } catch { warnings.push(`${name}: baseAddress 无效，已跳过`); continue; }
    const registers: SvdRegister[] = [];
    for (const register of peripheral.querySelectorAll(':scope > registers > register')) {
      const registerName = text(register, 'name'); if (!registerName) { warnings.push(`${name}: 跳过未命名寄存器`); continue; }
      try {
        const offset = numberValue(text(register, 'addressOffset')), size = numberValue(text(register, 'size'), numberValue(text(peripheral, 'size'), 32));
        const indices = expandIndices(register), increment = numberValue(text(register, 'dimIncrement'), 0);
        if (indices.length !== numberValue(text(register, 'dim'), 1)) throw new Error('dimIndex 数量与 dim 不一致');
        const fields: SvdField[] = [];
        for (const item of register.querySelectorAll(':scope > fields > field')) { const bits = fieldBits(item); if (bits.bitWidth < 1 || bits.bitOffset + bits.bitWidth > size) throw new Error(`字段 ${text(item, 'name')} 超出寄存器位宽`); const mask = bits.bitWidth >= 32 ? 0xffffffff : (((2 ** bits.bitWidth - 1) * 2 ** bits.bitOffset) >>> 0); fields.push({ name: text(item, 'name'), description: text(item, 'description'), ...bits, mask }); }
        for (const [arrayIndex, index] of indices.entries()) { const expandedName = registerName.includes('%s') ? registerName.replace('%s', index) : indices.length > 1 ? `${registerName}${index}` : registerName, expandedOffset = offset + arrayIndex * increment; registers.push({ id: `${name}.${expandedName}`, peripheral: name, name: expandedName, description: text(register, 'description'), address: baseAddress + expandedOffset, offset: expandedOffset, size, access: accessValue(register, peripheral), resetValue: text(register, 'resetValue') ? numberValue(text(register, 'resetValue')) : undefined, fields }); }
      } catch (error) { warnings.push(`${name}.${registerName}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    peripherals.push({ name, description: text(peripheral, 'description'), baseAddress, registers });
  }
  const registerCount = peripherals.reduce((sum, item) => sum + item.registers.length, 0), fieldCount = peripherals.reduce((sum, item) => sum + item.registers.reduce((total, register) => total + register.fields.length, 0), 0);
  return { name: text(device, 'name') || '未命名设备', description: text(device, 'description'), peripherals, registerCount, fieldCount, warnings };
}

export function searchSvd(device: SvdDevice, query: string, limit = 200) { const keyword = query.trim().toLowerCase(); const all = device.peripherals.flatMap(item => item.registers); if (!keyword) return all.slice(0, limit); return all.filter(item => [item.peripheral, item.name, item.description, ...item.fields.flatMap(field => [field.name, field.description])].some(value => value.toLowerCase().includes(keyword))).slice(0, limit); }
