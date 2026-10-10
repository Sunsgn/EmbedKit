const MAX_TABLE_BYTES = 8 * 1024 * 1024;
const MAX_SECTION_COUNT = 8192;
const MAX_SEGMENT_COUNT = 1024;
const MAX_SYMBOL_COUNT = 250000;

const machineNames = new Map([[3, 'x86'], [8, 'MIPS'], [20, 'PowerPC'], [40, 'Arm'], [62, 'x86-64'], [83, 'AVR'], [94, 'Xtensa'], [105, 'MSP430'], [183, 'AArch64'], [243, 'RISC-V']]);
const typeNames = new Map([[0, 'NONE'], [1, 'REL'], [2, 'EXEC'], [3, 'DYN'], [4, 'CORE']]);
const sectionTypeNames = new Map([[0, 'NULL'], [1, 'PROGBITS'], [2, 'SYMTAB'], [3, 'STRTAB'], [4, 'RELA'], [8, 'NOBITS'], [9, 'REL'], [11, 'DYNSYM']]);
const segmentTypeNames = new Map([[0, 'NULL'], [1, 'LOAD'], [2, 'DYNAMIC'], [3, 'INTERP'], [4, 'NOTE'], [6, 'PHDR'], [7, 'TLS']]);
const symbolTypes = ['NOTYPE', 'OBJECT', 'FUNC', 'SECTION', 'FILE', 'COMMON', 'TLS'];
const symbolBindings = ['LOCAL', 'GLOBAL', 'WEAK'];
const symbolVisibilities = ['DEFAULT', 'INTERNAL', 'HIDDEN', 'PROTECTED'];

function hex(value) { return `0x${value.toString(16).toUpperCase()}`; }
function safeNumber(value, label) { if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${label} exceeds the supported numeric range`); return Number(value); }
function cString(bytes, offset) { if (offset < 0 || offset >= bytes.length) return ''; let end = offset; while (end < bytes.length && bytes[end]) end += 1; return new TextDecoder().decode(bytes.subarray(offset, end)); }
function sectionLabel(index, sections) { if (index === 0) return 'UNDEF'; if (index === 0xfff1) return 'ABS'; if (index === 0xfff2) return 'COMMON'; return sections[index]?.name || `#${index}`; }

export function parseElfAddress(value) {
  const text = String(value ?? '').trim();
  if (!/^(?:0[xX][0-9a-fA-F]+|[0-9]+)$/.test(text)) throw new Error('Address must be hexadecimal (0x...) or decimal');
  const address = BigInt(text);
  if (address < 0n || address > 0xffffffffffffffffn) throw new Error('Address exceeds the supported 64-bit range');
  return address;
}

export function lookupElfAddress(analysis, value) {
  const requested = parseElfAddress(value);
  const address = analysis.machineId === 40 ? requested & ~1n : requested;
  const candidates = analysis.symbols
    .filter(symbol => symbol.sectionIndex !== 0 && ['FUNC', 'OBJECT', 'NOTYPE'].includes(symbol.type))
    .map(symbol => ({ symbol, start: BigInt(symbol.normalizedAddress), size: BigInt(symbol.size) }));
  const containing = candidates.filter(item => item.start <= address && item.size > 0n && address < item.start + item.size)
    .sort((a, b) => a.size < b.size ? -1 : a.size > b.size ? 1 : a.symbol.binding === 'LOCAL' && b.symbol.binding !== 'LOCAL' ? 1 : -1);
  const exact = candidates.filter(item => item.start === address)
    .sort((a, b) => a.symbol.type === 'FUNC' && b.symbol.type !== 'FUNC' ? -1 : a.symbol.binding === 'GLOBAL' && b.symbol.binding !== 'GLOBAL' ? -1 : 1);
  const previous = candidates.filter(item => item.start <= address)
    .sort((a, b) => a.start > b.start ? -1 : a.start < b.start ? 1 : a.symbol.binding === 'GLOBAL' ? -1 : 1)[0];
  const matched = exact[0] || containing[0] || previous;
  const section = analysis.sections.find(item => {
    const start = BigInt(item.address);
    return item.size > 0 && start <= address && address < start + BigInt(item.size);
  });
  let match = 'unresolved', confidence = 'none';
  if (exact[0]) { match = 'exact-symbol'; confidence = 'high'; }
  else if (containing[0]) { match = 'inside-symbol'; confidence = 'high'; }
  else if (previous && section && previous.symbol.sectionIndex === section.index) { match = 'nearest-symbol'; confidence = 'medium'; }
  else if (section) { match = 'section'; confidence = 'low'; }
  const useSymbol = matched && match !== 'section' && match !== 'unresolved';
  const source = lookupDwarfLine(analysis.lineRows || [], address);
  return {
    requestedAddress: hex(requested), normalizedAddress: hex(address), thumbBitCleared: requested !== address,
    match, confidence,
    symbol: useSymbol ? { ...matched.symbol, offset: hex(address - matched.start) } : null,
    section: section ? { index: section.index, name: section.name, address: section.address, size: section.size, offset: hex(address - BigInt(section.address)) } : null,
    source,
    note: source ? '由 DWARF 行表定位到源码；路径可能是编译时记录的相对路径' : match === 'unresolved' ? '地址不在已知节区或符号范围内' : match === 'section' ? '缺少可用符号，仅定位到节区' : match === 'nearest-symbol' ? '符号大小为零或地址位于符号间隙，结果为同节区最近前置符号' : '由 ELF 符号表定位；没有匹配的受支持 DWARF 源码行',
  };
}

export async function analyzeElf({ size, read }) {
  if (!Number.isSafeInteger(size) || size < 16) throw new Error('ELF file is too small');
  const first = await read(0, Math.min(size, 64));
  if (first[0] !== 0x7f || first[1] !== 0x45 || first[2] !== 0x4c || first[3] !== 0x46) throw new Error('File does not contain an ELF signature');
  const elfClass = first[4], dataEncoding = first[5];
  if (![1, 2].includes(elfClass)) throw new Error(`Unsupported ELF class ${elfClass}`);
  if (![1, 2].includes(dataEncoding)) throw new Error(`Unsupported ELF byte order ${dataEncoding}`);
  const bits = elfClass === 1 ? 32 : 64, littleEndian = dataEncoding === 1, headerSize = bits === 32 ? 52 : 64;
  if (size < headerSize) throw new Error('ELF header is truncated');
  const header = first.length >= headerSize ? first : await read(0, headerSize), view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const u16 = offset => view.getUint16(offset, littleEndian), u32 = offset => view.getUint32(offset, littleEndian), u64 = offset => view.getBigUint64(offset, littleEndian);
  const type = u16(16), machine = u16(18), entry = bits === 32 ? BigInt(u32(24)) : u64(24);
  const programOffset = safeNumber(bits === 32 ? BigInt(u32(28)) : u64(32), 'Program header offset');
  const sectionOffset = safeNumber(bits === 32 ? BigInt(u32(32)) : u64(40), 'Section header offset');
  const programEntrySize = u16(bits === 32 ? 42 : 54), programCount = u16(bits === 32 ? 44 : 56);
  const sectionEntrySize = u16(bits === 32 ? 46 : 58), sectionCount = u16(bits === 32 ? 48 : 60), stringSectionIndex = u16(bits === 32 ? 50 : 62);
  const warnings = [];
  if (sectionCount === 0) warnings.push('扩展节区数量当前未展开，节区结构可能不完整');
  if (stringSectionIndex === 0xffff) warnings.push('扩展节名索引当前未展开，节区名称可能不可用');
  if (sectionCount > MAX_SECTION_COUNT) throw new Error(`ELF section count exceeds ${MAX_SECTION_COUNT}`);
  if (programCount > MAX_SEGMENT_COUNT) throw new Error(`ELF program header count exceeds ${MAX_SEGMENT_COUNT}`);
  const parseTable = async (offset, entrySize, count, minimum, label) => {
    if (!count) return new Uint8Array();
    if (entrySize < minimum) throw new Error(`${label} entry size is invalid`);
    const length = entrySize * count;
    if (!Number.isSafeInteger(length) || length > MAX_TABLE_BYTES) throw new Error(`${label} table exceeds ${MAX_TABLE_BYTES} bytes`);
    if (offset < headerSize || offset + length > size) throw new Error(`${label} table is outside the file`);
    return await read(offset, length);
  };
  const sectionTable = await parseTable(sectionOffset, sectionEntrySize, sectionCount, bits === 32 ? 40 : 64, 'Section header');
  const rawSections = [];
  for (let index = 0; index < sectionCount; index += 1) {
    const base = index * sectionEntrySize, item = new DataView(sectionTable.buffer, sectionTable.byteOffset + base, sectionEntrySize);
    const get32 = offset => item.getUint32(offset, littleEndian), get64 = offset => item.getBigUint64(offset, littleEndian);
    rawSections.push({ index, nameOffset: get32(0), type: get32(4), flags: bits === 32 ? BigInt(get32(8)) : get64(8), address: bits === 32 ? BigInt(get32(12)) : get64(16), offset: safeNumber(bits === 32 ? BigInt(get32(16)) : get64(24), `Section ${index} offset`), size: safeNumber(bits === 32 ? BigInt(get32(20)) : get64(32), `Section ${index} size`), link: get32(bits === 32 ? 24 : 40), info: get32(bits === 32 ? 28 : 44), entrySize: safeNumber(bits === 32 ? BigInt(get32(36)) : get64(56), `Section ${index} entry size`) });
  }
  let sectionNames = new Uint8Array();
  if (stringSectionIndex < rawSections.length) {
    const strings = rawSections[stringSectionIndex];
    if (strings.size > MAX_TABLE_BYTES) warnings.push('节名字符串表过大，已跳过节区名称');
    else if (strings.offset + strings.size <= size) sectionNames = await read(strings.offset, strings.size);
    else warnings.push('节名字符串表超出文件范围');
  }
  const sections = rawSections.map(section => ({ index: section.index, name: cString(sectionNames, section.nameOffset) || (section.index === 0 ? '' : `#${section.index}`), type: sectionTypeNames.get(section.type) || `0x${section.type.toString(16)}`, flags: hex(section.flags), address: hex(section.address), offset: section.offset, size: section.size, entrySize: section.entrySize, link: section.link }));
  const programTable = await parseTable(programOffset, programEntrySize, programCount, bits === 32 ? 32 : 56, 'Program header');
  const segments = [];
  for (let index = 0; index < programCount; index += 1) {
    const base = index * programEntrySize, item = new DataView(programTable.buffer, programTable.byteOffset + base, programEntrySize), get32 = offset => item.getUint32(offset, littleEndian), get64 = offset => item.getBigUint64(offset, littleEndian);
    const segmentType = get32(0), flags = bits === 32 ? get32(24) : get32(4), offset = bits === 32 ? BigInt(get32(4)) : get64(8), virtualAddress = bits === 32 ? BigInt(get32(8)) : get64(16), physicalAddress = bits === 32 ? BigInt(get32(12)) : get64(24), fileSize = bits === 32 ? BigInt(get32(16)) : get64(32), memorySize = bits === 32 ? BigInt(get32(20)) : get64(40);
    segments.push({ index, type: segmentTypeNames.get(segmentType) || `0x${segmentType.toString(16)}`, flags, offset: hex(offset), virtualAddress: hex(virtualAddress), physicalAddress: hex(physicalAddress), fileSize: safeNumber(fileSize, `Segment ${index} file size`), memorySize: safeNumber(memorySize, `Segment ${index} memory size`) });
  }
  const symbols = [];
  for (const symbolSection of rawSections.filter(section => section.type === 2 || section.type === 11)) {
    const minimum = bits === 32 ? 16 : 24;
    if (!symbolSection.entrySize || symbolSection.entrySize < minimum) { warnings.push(`${sections[symbolSection.index].name} 的符号项大小无效，已跳过`); continue; }
    const count = Math.floor(symbolSection.size / symbolSection.entrySize);
    if (symbols.length + count > MAX_SYMBOL_COUNT) throw new Error(`ELF symbol count exceeds ${MAX_SYMBOL_COUNT}`);
    const strings = rawSections[symbolSection.link];
    if (!strings || strings.type !== 3 || strings.size > MAX_TABLE_BYTES || strings.offset + strings.size > size) { warnings.push(`${sections[symbolSection.index].name} 未关联有效字符串表，已跳过`); continue; }
    const table = await parseTable(symbolSection.offset, symbolSection.entrySize, count, minimum, `Symbol ${symbolSection.index}`), names = await read(strings.offset, strings.size);
    for (let index = 0; index < count; index += 1) {
      const item = new DataView(table.buffer, table.byteOffset + index * symbolSection.entrySize, symbolSection.entrySize);
      const nameOffset = item.getUint32(0, littleEndian), info = item.getUint8(bits === 32 ? 12 : 4), other = item.getUint8(bits === 32 ? 13 : 5), sectionIndex = item.getUint16(bits === 32 ? 14 : 6, littleEndian);
      const value = bits === 32 ? BigInt(item.getUint32(4, littleEndian)) : item.getBigUint64(8, littleEndian), symbolSize = bits === 32 ? BigInt(item.getUint32(8, littleEndian)) : item.getBigUint64(16, littleEndian);
      const symbolType = symbolTypes[info & 0xf] || `0x${(info & 0xf).toString(16)}`, normalized = machine === 40 && symbolType === 'FUNC' ? value & ~1n : value;
      symbols.push({ table: sections[symbolSection.index].name, index, name: cString(names, nameOffset) || (symbolType === 'SECTION' ? sectionLabel(sectionIndex, sections) : ''), address: hex(value), normalizedAddress: hex(normalized), size: safeNumber(symbolSize, `Symbol ${index} size`), binding: symbolBindings[info >> 4] || `0x${(info >> 4).toString(16)}`, type: symbolType, visibility: symbolVisibilities[other & 0x3] || `0x${(other & 0x3).toString(16)}`, sectionIndex, sectionName: sectionLabel(sectionIndex, sections) });
    }
  }
  const namedSymbols = symbols.filter(symbol => symbol.name && !['FILE', 'SECTION'].includes(symbol.type));
  const dwarfSections = sections.filter(section => /^\.(?:debug_|zdebug_|eh_frame)/.test(section.name)).map(section => section.name);
  let lineRows = [], dwarfVersions = [], dwarfLineUnits = 0;
  const lineSection = rawSections.find(section => sections[section.index].name === '.debug_line');
  if (lineSection) {
    if (lineSection.size > MAX_TABLE_BYTES || lineSection.offset + lineSection.size > size) warnings.push('.debug_line 超出有界解析范围，已跳过源码行');
    else {
      try {
        const parsed = parseDwarfLineSection(await read(lineSection.offset, lineSection.size), { littleEndian, addressSize: bits / 8 });
        lineRows = parsed.rows; dwarfVersions = parsed.versions; dwarfLineUnits = parsed.unitCount; warnings.push(...parsed.warnings);
      } catch (error) { warnings.push(`DWARF 行表解析失败：${error.message}`); }
    }
  }
  if (!symbols.length) warnings.push('未发现可解析符号表，地址到函数名定位能力受限');
  if (!dwarfSections.length) warnings.push('未发现 DWARF 调试节，无法直接定位源码行');
  return { format: 'ELF', bits, byteOrder: littleEndian ? 'little' : 'big', type: typeNames.get(type) || `0x${type.toString(16)}`, machine: machineNames.get(machine) || `Unknown (${machine})`, machineId: machine, entry: hex(entry), fileSize: size, sections, segments, symbols, symbolCount: symbols.length, namedSymbolCount: namedSymbols.length, hasSymbols: namedSymbols.length > 0, symbolPreview: namedSymbols.filter(symbol => ['FUNC', 'OBJECT'].includes(symbol.type)).slice(0, 100), dwarfSections, hasDwarf: dwarfSections.length > 0, dwarfVersions, dwarfLineUnits, dwarfLineCount: lineRows.filter(row => !row.endSequence).length, hasSourceLines: lineRows.some(row => !row.endSequence && row.file), lineRows, warnings };
}
import { lookupDwarfLine, parseDwarfLineSection } from './dwarf.js';
