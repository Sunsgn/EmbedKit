const MAX_LINE_ROWS = 500000;
const MAX_LINE_UNITS = 4096;

function readUnsigned(view, offset, size, littleEndian) {
  if (size === 4) return BigInt(view.getUint32(offset, littleEndian));
  if (size === 8) return view.getBigUint64(offset, littleEndian);
  let value = 0n;
  if (littleEndian) for (let index = size - 1; index >= 0; index -= 1) value = (value << 8n) | BigInt(view.getUint8(offset + index));
  else for (let index = 0; index < size; index += 1) value = (value << 8n) | BigInt(view.getUint8(offset + index));
  return value;
}

function readLeb(bytes, start, signed = false) {
  let offset = start, value = 0n, shift = 0n, byte = 0;
  do {
    if (offset >= bytes.length || shift > 70n) throw new Error('DWARF LEB128 value is truncated or too large');
    byte = bytes[offset++]; value |= BigInt(byte & 0x7f) << shift; shift += 7n;
  } while (byte & 0x80);
  if (signed && (byte & 0x40)) value |= (-1n) << shift;
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('DWARF LEB128 value exceeds the supported numeric range');
  return { value: number, offset };
}

function readString(bytes, start, limit) {
  let end = start;
  while (end < limit && bytes[end]) end += 1;
  if (end >= limit) throw new Error('DWARF string is not terminated inside its unit');
  return { value: new TextDecoder().decode(bytes.subarray(start, end)), offset: end + 1 };
}

export function parseDwarfLineSection(bytes, { littleEndian, addressSize }) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), rows = [], versions = new Set(), warnings = [];
  let offset = 0, unitCount = 0, sequence = 0;
  while (offset < bytes.length) {
    if (bytes.length - offset < 4) { if (bytes.slice(offset).some(Boolean)) warnings.push('DWARF 行表尾部不足 4 字节，已停止解析'); break; }
    let unitLength = view.getUint32(offset, littleEndian), lengthSize = 4; offset += 4;
    if (unitLength === 0) continue;
    if (unitLength === 0xffffffff) { if (offset + 8 > bytes.length) throw new Error('DWARF64 line unit length is truncated'); unitLength = Number(view.getBigUint64(offset, littleEndian)); offset += 8; lengthSize = 8; }
    const unitEnd = offset + unitLength;
    if (!Number.isSafeInteger(unitLength) || unitEnd > bytes.length) throw new Error('DWARF line unit exceeds the section boundary');
    if (++unitCount > MAX_LINE_UNITS) throw new Error(`DWARF line unit count exceeds ${MAX_LINE_UNITS}`);
    if (offset + 2 > unitEnd) throw new Error('DWARF line unit header is truncated');
    const version = view.getUint16(offset, littleEndian); offset += 2; versions.add(version);
    if (version < 2 || version > 4) { warnings.push(`DWARF v${version} 行表当前未解析`); offset = unitEnd; continue; }
    if (offset + lengthSize > unitEnd) throw new Error('DWARF line header length is truncated');
    const headerLength = Number(readUnsigned(view, offset, lengthSize, littleEndian)); offset += lengthSize;
    const headerEnd = offset + headerLength;
    if (!Number.isSafeInteger(headerLength) || headerEnd > unitEnd) throw new Error('DWARF line header exceeds its unit');
    const minimumInstructionLength = bytes[offset++], maximumOperations = version >= 4 ? bytes[offset++] : 1, defaultIsStatement = bytes[offset++] !== 0;
    const lineBase = view.getInt8(offset++), lineRange = bytes[offset++], opcodeBase = bytes[offset++];
    if (!minimumInstructionLength || !maximumOperations || !lineRange || !opcodeBase) throw new Error('DWARF line header contains invalid zero parameters');
    const standardLengths = [...bytes.subarray(offset, offset + opcodeBase - 1)]; offset += opcodeBase - 1;
    if (offset > headerEnd) throw new Error('DWARF standard opcode lengths exceed the line header');
    const directories = [''];
    while (offset < headerEnd) { const item = readString(bytes, offset, headerEnd); offset = item.offset; if (!item.value) break; directories.push(item.value); }
    const files = [null];
    while (offset < headerEnd) {
      const item = readString(bytes, offset, headerEnd); offset = item.offset; if (!item.value) break;
      const directory = readLeb(bytes, offset); offset = directory.offset;
      const modified = readLeb(bytes, offset); offset = modified.offset;
      const fileSize = readLeb(bytes, offset); offset = fileSize.offset;
      files.push({ name: item.value, directory: directory.value });
    }
    offset = headerEnd;
    const initial = () => ({ address: 0n, operation: 0, file: 1, line: 1, column: 0, isStatement: defaultIsStatement });
    let state = initial(); sequence += 1;
    const advanceAddress = operationAdvance => { const total = state.operation + operationAdvance; state.address += BigInt(minimumInstructionLength * Math.floor(total / maximumOperations)); state.operation = total % maximumOperations; };
    const emit = endSequence => {
      if (rows.length >= MAX_LINE_ROWS) throw new Error(`DWARF line row count exceeds ${MAX_LINE_ROWS}`);
      const file = files[state.file], directory = file ? directories[file.directory] || '' : '';
      rows.push({ address: `0x${state.address.toString(16).toUpperCase()}`, file: file ? (directory ? `${directory.replace(/[\\/]+$/, '')}/${file.name}` : file.name) : '', line: state.line, column: state.column, isStatement: state.isStatement, endSequence, sequence });
    };
    while (offset < unitEnd) {
      const opcode = bytes[offset++];
      if (opcode === 0) {
        const length = readLeb(bytes, offset); offset = length.offset; const extendedEnd = offset + length.value;
        if (!length.value || extendedEnd > unitEnd) throw new Error('DWARF extended opcode exceeds its unit');
        const extended = bytes[offset++];
        if (extended === 1) { emit(true); state = initial(); sequence += 1; }
        else if (extended === 2) { const available = extendedEnd - offset; if (available < addressSize) throw new Error('DWARF set-address operand is truncated'); state.address = readUnsigned(view, offset, addressSize, littleEndian); state.operation = 0; }
        offset = extendedEnd;
      } else if (opcode < opcodeBase) {
        if (opcode === 1) emit(false);
        else if (opcode === 2) { const value = readLeb(bytes, offset); offset = value.offset; advanceAddress(value.value); }
        else if (opcode === 3) { const value = readLeb(bytes, offset, true); offset = value.offset; state.line += value.value; }
        else if (opcode === 4) { const value = readLeb(bytes, offset); offset = value.offset; state.file = value.value; }
        else if (opcode === 5) { const value = readLeb(bytes, offset); offset = value.offset; state.column = value.value; }
        else if (opcode === 6) state.isStatement = !state.isStatement;
        else if (opcode === 8) advanceAddress(Math.floor((255 - opcodeBase) / lineRange));
        else if (opcode === 9) { if (offset + 2 > unitEnd) throw new Error('DWARF fixed advance is truncated'); state.address += BigInt(view.getUint16(offset, littleEndian)); state.operation = 0; offset += 2; }
        else {
          const operandCount = standardLengths[opcode - 1] || 0;
          for (let index = 0; index < operandCount; index += 1) { const value = readLeb(bytes, offset); offset = value.offset; }
        }
      } else {
        const adjusted = opcode - opcodeBase;
        advanceAddress(Math.floor(adjusted / lineRange)); state.line += lineBase + (adjusted % lineRange); emit(false);
      }
    }
    offset = unitEnd;
  }
  return { rows, versions: [...versions].sort((a, b) => a - b), warnings, unitCount };
}

export function lookupDwarfLine(rows, value) {
  const address = typeof value === 'bigint' ? value : BigInt(value), candidates = rows.filter(row => !row.endSequence && BigInt(row.address) <= address).sort((a, b) => BigInt(a.address) > BigInt(b.address) ? -1 : 1);
  for (const row of candidates) {
    const end = rows.find(item => item.sequence === row.sequence && item.endSequence);
    if ((!end || address < BigInt(end.address)) && row.file && row.line > 0) return { file: row.file, line: row.line, column: row.column, address: row.address };
  }
  return null;
}
