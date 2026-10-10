import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeElf } from './elf.js';

function fixtureElf32() {
  const bytes = new Uint8Array(0x200), view = new DataView(bytes.buffer), strings = new TextEncoder().encode('\0.shstrtab\0.text\0.symtab\0.debug_info\0');
  bytes.set([0x7f, 0x45, 0x4c, 0x46, 1, 1, 1], 0);
  view.setUint16(16, 2, true); view.setUint16(18, 40, true); view.setUint32(20, 1, true); view.setUint32(24, 0x08000101, true);
  view.setUint32(28, 52, true); view.setUint32(32, 0x100, true); view.setUint16(40, 52, true); view.setUint16(42, 32, true); view.setUint16(44, 1, true); view.setUint16(46, 40, true); view.setUint16(48, 5, true); view.setUint16(50, 1, true);
  view.setUint32(52, 1, true); view.setUint32(56, 0x80, true); view.setUint32(60, 0x08000000, true); view.setUint32(64, 0x08000000, true); view.setUint32(68, 16, true); view.setUint32(72, 16, true); view.setUint32(76, 5, true); view.setUint32(80, 4, true);
  bytes.set(strings, 0x80);
  const section = (index, name, type, flags, address, offset, size, entrySize = 0) => { const base = 0x100 + index * 40; view.setUint32(base, name, true); view.setUint32(base + 4, type, true); view.setUint32(base + 8, flags, true); view.setUint32(base + 12, address, true); view.setUint32(base + 16, offset, true); view.setUint32(base + 20, size, true); view.setUint32(base + 36, entrySize, true); };
  section(1, 1, 3, 0, 0, 0x80, strings.length);
  section(2, 11, 1, 6, 0x08000000, 0xc0, 16);
  section(3, 17, 2, 0, 0, 0xd0, 32, 16);
  section(4, 25, 1, 0, 0, 0xf0, 8);
  return bytes;
}

const source = bytes => ({ size: bytes.length, read: async (offset, length) => bytes.slice(offset, offset + length) });

test('parses bounded ELF metadata, segments, symbols and DWARF evidence', async () => {
  const result = await analyzeElf(source(fixtureElf32()));
  assert.equal(result.bits, 32);
  assert.equal(result.byteOrder, 'little');
  assert.equal(result.machine, 'Arm');
  assert.equal(result.entry, '0x8000101');
  assert.equal(result.segments[0].type, 'LOAD');
  assert.equal(result.sections[2].name, '.text');
  assert.equal(result.symbolCount, 2);
  assert.equal(result.hasSymbols, true);
  assert.deepEqual(result.dwarfSections, ['.debug_info']);
  assert.equal(result.hasDwarf, true);
});

test('rejects non-ELF and truncated table input without reading outside the file', async () => {
  await assert.rejects(analyzeElf(source(new Uint8Array(32))), /ELF signature/);
  const bytes = fixtureElf32(); new DataView(bytes.buffer).setUint32(32, 0x1f0, true);
  await assert.rejects(analyzeElf(source(bytes)), /outside the file/);
});

test('supports 64-bit big-endian headers and degrades unknown architectures explicitly', async () => {
  const bytes = new Uint8Array(64), view = new DataView(bytes.buffer);
  bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 2, 1], 0);
  view.setUint16(16, 3, false); view.setUint16(18, 999, false); view.setUint32(20, 1, false); view.setBigUint64(24, 0x1234567890n, false);
  view.setUint16(52, 64, false); view.setUint16(54, 56, false); view.setUint16(58, 64, false);
  const result = await analyzeElf(source(bytes));
  assert.equal(result.bits, 64);
  assert.equal(result.byteOrder, 'big');
  assert.equal(result.machine, 'Unknown (999)');
  assert.equal(result.entry, '0x1234567890');
  assert.equal(result.hasSymbols, false);
  assert.ok(result.warnings.some(item => /符号表/.test(item)));
});
