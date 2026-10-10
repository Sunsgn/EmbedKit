import assert from 'node:assert/strict';
import test from 'node:test';
import { lookupDwarfLine, parseDwarfLineSection } from './dwarf.js';

function dwarf4LineTable() {
  const directories = [0x73, 0x72, 0x63, 0, 0], files = [0x6d, 0x61, 0x69, 0x6e, 0x2e, 0x63, 0, 1, 0, 0, 0];
  const header = [1, 1, 1, 0xfb, 14, 13, ...new Array(12).fill(0), ...directories, ...files];
  const program = [0, 5, 2, 0x00, 0x01, 0x00, 0x08, 1, 3, 9, 2, 4, 1, 2, 4, 0, 1, 1];
  const bytes = new Uint8Array(4 + 2 + 4 + header.length + program.length), view = new DataView(bytes.buffer);
  view.setUint32(0, bytes.length - 4, true); view.setUint16(4, 4, true); view.setUint32(6, header.length, true);
  bytes.set(header, 10); bytes.set(program, 10 + header.length);
  return bytes;
}

function dwarf5LineTable() {
  const directories = [1, 1, 8, 1, 0x73, 0x72, 0x63, 0];
  const files = [2, 1, 8, 2, 0x0f, 1, 0x6d, 0x61, 0x69, 0x6e, 0x2e, 0x63, 0, 0];
  const header = [1, 1, 1, 0xfb, 14, 13, ...new Array(12).fill(0), ...directories, ...files];
  const program = [0, 5, 2, 0x00, 0x01, 0x00, 0x08, 1, 3, 9, 2, 4, 1, 2, 4, 0, 1, 1];
  const bytes = new Uint8Array(4 + 2 + 2 + 4 + header.length + program.length), view = new DataView(bytes.buffer);
  view.setUint32(0, bytes.length - 4, true); view.setUint16(4, 5, true); bytes[6] = 4; bytes[7] = 0; view.setUint32(8, header.length, true);
  bytes.set(header, 12); bytes.set(program, 12 + header.length);
  return bytes;
}

function dwarf5LineStringTable() {
  const directories = [1, 1, 0x1f, 1, 0, 0, 0, 0];
  const files = [2, 1, 0x1f, 2, 0x0f, 1, 4, 0, 0, 0, 0];
  const header = [1, 1, 1, 0xfb, 14, 13, ...new Array(12).fill(0), ...directories, ...files];
  const program = [0, 5, 2, 0x00, 0x01, 0x00, 0x08, 1, 2, 8, 0, 1, 1];
  const bytes = new Uint8Array(12 + header.length + program.length), view = new DataView(bytes.buffer);
  view.setUint32(0, bytes.length - 4, true); view.setUint16(4, 5, true); bytes[6] = 4; view.setUint32(8, header.length, true); bytes.set(header, 12); bytes.set(program, 12 + header.length);
  return bytes;
}

test('decodes bounded DWARF v4 line programs and source ranges', () => {
  const result = parseDwarfLineSection(dwarf4LineTable(), { littleEndian: true, addressSize: 4 });
  assert.deepEqual(result.versions, [4]);
  assert.equal(result.unitCount, 1);
  assert.equal(result.rows[0].file, 'src/main.c');
  assert.equal(result.rows[0].line, 1);
  assert.deepEqual(lookupDwarfLine(result.rows, 0x08000105n), { file: 'src/main.c', line: 10, column: 0, address: '0x8000104' });
  assert.equal(lookupDwarfLine(result.rows, 0x08000108n), null);
});

test('decodes DWARF v5 directory and file descriptor tables', () => {
  const result = parseDwarfLineSection(dwarf5LineTable(), { littleEndian: true, addressSize: 4 });
  assert.deepEqual(result.versions, [5]); assert.equal(result.rows[0].file, 'src/main.c');
  assert.equal(lookupDwarfLine(result.rows, 0x08000105n).line, 10);
});

test('resolves DWARF v5 line_strp paths from the companion string section', () => {
  const strings = new TextEncoder().encode('src\0main.c\0');
  const result = parseDwarfLineSection(dwarf5LineStringTable(), { littleEndian: true, addressSize: 4, lineStringBytes: strings });
  assert.equal(result.rows[0].file, 'src/main.c'); assert.equal(result.warnings.length, 0);
});

test('reports unsupported versions without manufacturing source rows', () => {
  const bytes = new Uint8Array(6), view = new DataView(bytes.buffer); view.setUint32(0, 2, true); view.setUint16(4, 6, true);
  const result = parseDwarfLineSection(bytes, { littleEndian: true, addressSize: 4 });
  assert.deepEqual(result.versions, [6]); assert.equal(result.rows.length, 0); assert.match(result.warnings[0], /v6/);
});

test('rejects line units that cross the section boundary', () => {
  const bytes = dwarf4LineTable(); new DataView(bytes.buffer).setUint32(0, bytes.length, true);
  assert.throws(() => parseDwarfLineSection(bytes, { littleEndian: true, addressSize: 4 }), /boundary/);
});
