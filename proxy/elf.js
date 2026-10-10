const MAX_TABLE_BYTES = 8 * 1024 * 1024;
const MAX_SECTION_COUNT = 8192;
const MAX_SEGMENT_COUNT = 1024;

const machineNames = new Map([[3, 'x86'], [8, 'MIPS'], [20, 'PowerPC'], [40, 'Arm'], [62, 'x86-64'], [83, 'AVR'], [94, 'Xtensa'], [105, 'MSP430'], [183, 'AArch64'], [243, 'RISC-V']]);
const typeNames = new Map([[0, 'NONE'], [1, 'REL'], [2, 'EXEC'], [3, 'DYN'], [4, 'CORE']]);
const sectionTypeNames = new Map([[0, 'NULL'], [1, 'PROGBITS'], [2, 'SYMTAB'], [3, 'STRTAB'], [4, 'RELA'], [8, 'NOBITS'], [9, 'REL'], [11, 'DYNSYM']]);
const segmentTypeNames = new Map([[0, 'NULL'], [1, 'LOAD'], [2, 'DYNAMIC'], [3, 'INTERP'], [4, 'NOTE'], [6, 'PHDR'], [7, 'TLS']]);

function hex(value) { return `0x${value.toString(16).toUpperCase()}`; }
function safeNumber(value, label) { if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${label} exceeds the supported numeric range`); return Number(value); }
function cString(bytes, offset) { if (offset < 0 || offset >= bytes.length) return ''; let end = offset; while (end < bytes.length && bytes[end]) end += 1; return new TextDecoder().decode(bytes.subarray(offset, end)); }

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
  if (sectionCount === 0) warnings.push('扩展节区数量当前未展开，节区结果可能不完整');
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
    rawSections.push({ index, nameOffset: get32(0), type: get32(4), flags: bits === 32 ? BigInt(get32(8)) : get64(8), address: bits === 32 ? BigInt(get32(12)) : get64(16), offset: safeNumber(bits === 32 ? BigInt(get32(16)) : get64(24), `Section ${index} offset`), size: safeNumber(bits === 32 ? BigInt(get32(20)) : get64(32), `Section ${index} size`), entrySize: safeNumber(bits === 32 ? BigInt(get32(36)) : get64(56), `Section ${index} entry size`) });
  }
  let sectionNames = new Uint8Array();
  if (stringSectionIndex < rawSections.length) {
    const strings = rawSections[stringSectionIndex];
    if (strings.size > MAX_TABLE_BYTES) warnings.push('节名字符串表过大，已跳过节区名称');
    else if (strings.offset + strings.size <= size) sectionNames = await read(strings.offset, strings.size);
    else warnings.push('节名字符串表超出文件范围');
  }
  const sections = rawSections.map(section => ({ index: section.index, name: cString(sectionNames, section.nameOffset) || (section.index === 0 ? '' : `#${section.index}`), type: sectionTypeNames.get(section.type) || `0x${section.type.toString(16)}`, flags: hex(section.flags), address: hex(section.address), offset: section.offset, size: section.size, entrySize: section.entrySize }));

  const programTable = await parseTable(programOffset, programEntrySize, programCount, bits === 32 ? 32 : 56, 'Program header');
  const segments = [];
  for (let index = 0; index < programCount; index += 1) {
    const base = index * programEntrySize, item = new DataView(programTable.buffer, programTable.byteOffset + base, programEntrySize), get32 = offset => item.getUint32(offset, littleEndian), get64 = offset => item.getBigUint64(offset, littleEndian);
    const segmentType = get32(0), flags = bits === 32 ? get32(24) : get32(4), offset = bits === 32 ? BigInt(get32(4)) : get64(8), virtualAddress = bits === 32 ? BigInt(get32(8)) : get64(16), physicalAddress = bits === 32 ? BigInt(get32(12)) : get64(24), fileSize = bits === 32 ? BigInt(get32(16)) : get64(32), memorySize = bits === 32 ? BigInt(get32(20)) : get64(40);
    segments.push({ index, type: segmentTypeNames.get(segmentType) || `0x${segmentType.toString(16)}`, flags, offset: hex(offset), virtualAddress: hex(virtualAddress), physicalAddress: hex(physicalAddress), fileSize: safeNumber(fileSize, `Segment ${index} file size`), memorySize: safeNumber(memorySize, `Segment ${index} memory size`) });
  }
  const symbolSections = sections.filter(section => section.type === 'SYMTAB' || section.type === 'DYNSYM');
  const symbolCount = symbolSections.reduce((sum, section) => sum + (section.entrySize ? Math.floor(section.size / section.entrySize) : 0), 0);
  const dwarfSections = sections.filter(section => /^\.(?:debug_|zdebug_|eh_frame)/.test(section.name)).map(section => section.name);
  if (!symbolSections.length) warnings.push('未发现符号表，地址到函数名定位能力受限');
  if (!dwarfSections.length) warnings.push('未发现 DWARF 调试节，无法直接定位源码行');
  return { format: 'ELF', bits, byteOrder: littleEndian ? 'little' : 'big', type: typeNames.get(type) || `0x${type.toString(16)}`, machine: machineNames.get(machine) || `Unknown (${machine})`, machineId: machine, entry: hex(entry), fileSize: size, sections, segments, symbolCount, hasSymbols: symbolSections.length > 0, dwarfSections, hasDwarf: dwarfSections.length > 0, warnings };
}
