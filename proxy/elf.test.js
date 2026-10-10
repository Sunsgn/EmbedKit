import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { analyzeElf, decompressDebugSection, lookupElfAddress, parseElfAddress } from './elf.js';

function fixtureElf32() {
  const bytes = new Uint8Array(0x400), view = new DataView(bytes.buffer), strings = new TextEncoder().encode('\0.shstrtab\0.text\0.symtab\0.debug_line\0.strtab\0'), symbolNames = new TextEncoder().encode('\0main\0');
  bytes.set([0x7f, 0x45, 0x4c, 0x46, 1, 1, 1], 0);
  view.setUint16(16, 2, true); view.setUint16(18, 40, true); view.setUint32(20, 1, true); view.setUint32(24, 0x08000101, true);
  view.setUint32(28, 52, true); view.setUint32(32, 0x200, true); view.setUint16(40, 52, true); view.setUint16(42, 32, true); view.setUint16(44, 1, true); view.setUint16(46, 40, true); view.setUint16(48, 6, true); view.setUint16(50, 1, true);
  view.setUint32(52, 1, true); view.setUint32(56, 0x80, true); view.setUint32(60, 0x08000000, true); view.setUint32(64, 0x08000000, true); view.setUint32(68, 16, true); view.setUint32(72, 16, true); view.setUint32(76, 5, true); view.setUint32(80, 4, true);
  bytes.set(strings, 0x80); bytes.set(symbolNames, 0xc0);
  const section = (index, name, type, flags, address, offset, size, entrySize = 0, link = 0) => { const base = 0x200 + index * 40; view.setUint32(base, name, true); view.setUint32(base + 4, type, true); view.setUint32(base + 8, flags, true); view.setUint32(base + 12, address, true); view.setUint32(base + 16, offset, true); view.setUint32(base + 20, size, true); view.setUint32(base + 24, link, true); view.setUint32(base + 36, entrySize, true); };
  section(1, 1, 3, 0, 0, 0x80, strings.length);
  section(2, 11, 1, 6, 0x08000100, 0x100, 32);
  section(3, 17, 2, 0, 0, 0x120, 32, 16, 5);
  const lineHeader = [1, 1, 1, 0xfb, 14, 13, ...new Array(12).fill(0), 0x73, 0x72, 0x63, 0, 0, 0x6d, 0x61, 0x69, 0x6e, 0x2e, 0x63, 0, 1, 0, 0, 0];
  const lineProgram = [0, 5, 2, 0x00, 0x01, 0x00, 0x08, 1, 3, 9, 2, 4, 1, 2, 4, 0, 1, 1], lineLength = 4 + 2 + 4 + lineHeader.length + lineProgram.length;
  view.setUint32(0x150, lineLength - 4, true); view.setUint16(0x154, 4, true); view.setUint32(0x156, lineHeader.length, true); bytes.set(lineHeader, 0x15a); bytes.set(lineProgram, 0x15a + lineHeader.length);
  section(4, 25, 1, 0, 0, 0x150, lineLength);
  section(5, 37, 3, 0, 0, 0xc0, symbolNames.length);
  view.setUint32(0x130, 1, true); view.setUint32(0x134, 0x08000101, true); view.setUint32(0x138, 12, true); view.setUint8(0x13c, 0x12); view.setUint16(0x13e, 2, true);
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
  assert.equal(result.namedSymbolCount, 1);
  assert.equal(result.hasSymbols, true);
  assert.equal(result.symbolPreview[0].name, 'main');
  assert.equal(result.symbolPreview[0].normalizedAddress, '0x8000100');
  assert.deepEqual(result.dwarfSections, ['.debug_line']);
  assert.equal(result.hasDwarf, true);
  assert.equal(result.hasSourceLines, true);
  assert.equal(result.dwarfLineCount, 2);
});

test('resolves Arm Thumb addresses to exact symbols, offsets, and section-only evidence', async () => {
  const result = await analyzeElf(source(fixtureElf32()));
  const exact = lookupElfAddress(result, '0x08000101');
  assert.equal(exact.match, 'exact-symbol');
  assert.equal(exact.thumbBitCleared, true);
  assert.equal(exact.symbol.name, 'main');
  assert.equal(exact.symbol.offset, '0x0');
  const inside = lookupElfAddress(result, '0x08000106');
  assert.equal(inside.match, 'inside-symbol');
  assert.equal(inside.symbol.offset, '0x6');
  assert.deepEqual(inside.source, { file: 'src/main.c', line: 10, column: 0, address: '0x8000104' });
  const sectionOnly = lookupElfAddress({ ...result, symbols: [] }, '0x08000110');
  assert.equal(sectionOnly.match, 'section');
  assert.equal(sectionOnly.section.name, '.text');
  assert.equal(sectionOnly.source, null);
  assert.throws(() => parseElfAddress('main+4'), /hexadecimal/);
});

test('rejects non-ELF and truncated table input without reading outside the file', async () => {
  await assert.rejects(analyzeElf(source(new Uint8Array(32))), /ELF signature/);
  const bytes = fixtureElf32(); new DataView(bytes.buffer).setUint32(32, 0x3f0, true);
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

test('decompresses GNU and ELF compressed debug sections with declared-size checks', () => {
  const original = new TextEncoder().encode('bounded dwarf line data'), compressed = deflateSync(original);
  const gnu = new Uint8Array(12 + compressed.length), gnuView = new DataView(gnu.buffer); gnu.set(new TextEncoder().encode('ZLIB')); gnuView.setBigUint64(4, BigInt(original.length), false); gnu.set(compressed, 12);
  assert.deepEqual(decompressDebugSection(gnu, { name: '.zdebug_line', flags: '0x0' }, 32, true), original);
  const elf = new Uint8Array(12 + compressed.length), elfView = new DataView(elf.buffer); elfView.setUint32(0, 1, true); elfView.setUint32(4, original.length, true); elfView.setUint32(8, 1, true); elf.set(compressed, 12);
  assert.deepEqual(decompressDebugSection(elf, { name: '.debug_line', flags: '0x800' }, 32, true), original);
  gnuView.setBigUint64(4, BigInt(original.length + 1), false);
  assert.throws(() => decompressDebugSection(gnu, { name: '.zdebug_line', flags: '0x0' }, 32, true), /长度/);
});
