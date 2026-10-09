import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeMap, detectMapFormat } from '../src/utils/mapAnalyzer.ts';

test('parses GNU ld memory regions, sections and modules', () => {
  const content = `Memory Configuration
Name             Origin             Length             Attributes
FLASH            0x0000000008000000 0x0000000000010000 xr
RAM              0x0000000020000000 0x0000000000005000 xrw
Linker script and memory map
.text           0x0000000008000000       0x30
 .text.main     0x0000000008000000       0x20 build/main.o
.rodata         0x0000000008000030       0x10
.data           0x0000000020000000        0x8
 .data.state    0x0000000020000000        0x8 build/state.o
.bss            0x0000000020000008       0x20
 .bss.buffer    0x0000000020000008       0x20 build/state.o`;
  assert.equal(detectMapFormat(content), 'gnu');
  const result = analyzeMap(content);
  assert.equal(result.totals.flash, 0x48);
  assert.equal(result.totals.ram, 0x28);
  assert.equal(result.regions.find(item => item.name === 'FLASH')?.used, 0x40);
  assert.equal(result.modules.find(item => item.name === 'state.o')?.total, 0x28);
});

test('parses Keil execution regions and component sizes', () => {
  const content = `ARM Linker, 5.06
Memory Map of the image
Execution Region ER_IROM1 (Exec base: 0x08000000, Load base: 0x08000000, Size: 0x00000100, Max: 0x00010000)
Image component sizes
   120          4         20          8         32          0   main.o`;
  const result = analyzeMap(content);
  assert.equal(result.format, 'keil-armcc');
  assert.equal(result.regions[0].used, 0x100);
  assert.equal(result.modules[0].code, 120);
  assert.equal(result.modules[0].ziData, 32);
});

test('parses IAR memory totals', () => {
  const content = `IAR ELF Linker V9
MODULE SUMMARY
  1,024 bytes of readonly code memory
  128 bytes of readonly data memory
  64 bytes of readwrite data memory
  256 bytes of zero initialized data memory`;
  const result = analyzeMap(content);
  assert.equal(result.format, 'iar');
  assert.equal(result.totals.flash, 1216);
  assert.equal(result.totals.ram, 320);
});

test('detects ArmClang independently from legacy ARMCC', () => {
  const content = `ARM Linker, 6.21.0
Toolchain: Arm Compiler 6
Memory Map of the image
Execution Region ER_IROM1 (Exec base: 0x08000000, Load base: 0x08000000, Size: 0x00009000, Max: 0x00010000)
Image component sizes
   32768          0       2048        512       4096          0   network.o`;
  const result = analyzeMap(content);
  assert.equal(result.format, 'keil-armclang');
  assert.equal(result.coverage.confidence, 'high');
  assert.equal(result.insights.some(item => item.module === 'network.o'), true);
});

test('reports capacity risk and parser coverage as product conclusions', () => {
  const content = `Memory Configuration
Name             Origin             Length             Attributes
FLASH            0x08000000         0x00000100         xr
RAM              0x20000000         0x00000100         xrw
Linker script and memory map
.text            0x08000000         0x000000f0
 .text.main      0x08000000         0x000000f0 build/main.o
.bss             0x20000000         0x000000e8
 .bss.rx_buffer  0x20000000         0x000000e8 build/transport.o`;
  const result = analyzeMap(content);
  assert.equal(result.coverage.capabilities.capacity, true);
  assert.equal(result.insights.some(item => item.severity === 'critical' && item.category === 'capacity'), true);
  assert.equal(result.insights.some(item => item.module === 'transport.o'), true);
});

test('unknown maps degrade safely and expose low confidence instead of pretending success', () => {
  const result = analyzeMap('vendor proprietary link report\nno standard tables');
  assert.equal(result.format, 'unknown');
  assert.equal(result.coverage.confidence, 'low');
  assert.equal(result.insights[0].category, 'quality');
  assert.match(result.warnings[0], /降级解析/);
});

test('quantifies optimization candidates with explicit confidence and evidence', () => {
  const content = `ARM Linker, 6.21.0
ArmClang
Memory Map of the image
Execution Region ER_IROM1 (Exec base: 0x08000000, Load base: 0x08000000, Size: 0x00009000, Max: 0x00010000)
Image component sizes
   16384          0       4096        512       8192          0   network.o`;
  const result = analyzeMap(content);
  assert.equal(result.optimizations.length > 0, true);
  assert.equal(result.optimizations.every(item => item.maxBytes >= item.minBytes), true);
  assert.equal(result.optimizations.some(item => item.module === 'network.o' && item.target === 'ram'), true);
});
