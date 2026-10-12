import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyzeElf } from './elf.js';
import { analyzeMap } from '../frontend/src/utils/mapAnalyzer.ts';

const available = command => spawnSync(command, ['--version'], { windowsHide: true, encoding: 'utf8' }).status === 0;
const run = (command, args, cwd) => { const result = spawnSync(command, args, { cwd, windowsHide: true, encoding: 'utf8' }); if (result.status !== 0) throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`); };
const source = bytes => ({ size: bytes.length, read: async (offset, length) => bytes.subarray(offset, offset + length) });

test('analyzes reproducible artifacts emitted by a real GNU toolchain', async context => {
  const cc = process.env.CC || 'gcc', objcopy = process.env.OBJCOPY || 'objcopy';
  if (!available(cc) || !available(objcopy)) { context.skip('GNU compiler and objcopy are not installed'); return; }
  const directory = await mkdtemp(join(tmpdir(), 'embedkit-gnu-artifacts-'));
  try {
    const sourcePath = join(directory, 'sample.c'), executablePath = join(directory, process.platform === 'win32' ? 'sample.exe' : 'sample'), mapPath = join(directory, 'sample.map'), elfPath = join(directory, 'sample.elf'), binPath = join(directory, 'sample.bin'), hexPath = join(directory, 'sample.hex');
    await writeFile(sourcePath, 'volatile unsigned counter = 7;\nstatic unsigned step(unsigned value) { return value * 3u + 1u; }\nint main(void) { counter = step(counter); return (int)counter; }\n');
    run(cc, ['-g', '-Os', '-ffunction-sections', '-fdata-sections', sourcePath, `-Wl,-Map,${mapPath}`, '-o', executablePath], directory);
    if (process.platform === 'win32') run(objcopy, ['-O', 'elf64-x86-64', executablePath, elfPath], directory); else await copyFile(executablePath, elfPath);
    run(objcopy, ['-O', 'binary', executablePath, binPath], directory); run(objcopy, ['-O', 'ihex', executablePath, hexPath], directory);

    const elfBytes = await readFile(elfPath), mapText = await readFile(mapPath, 'utf8'), binBytes = await readFile(binPath), hexText = await readFile(hexPath, 'utf8');
    const elf = await analyzeElf(source(elfBytes)), map = analyzeMap(mapText);
    assert.equal(elf.machine, 'x86-64'); assert.ok(elf.namedSymbolCount > 0); assert.ok(elf.symbols.some(symbol => symbol.name === 'main'));
    assert.equal(map.format, 'gnu'); assert.ok(map.coverage.score > 0); assert.match(mapText, /main/);
    assert.ok(binBytes.length > 0); assert.match(hexText, /:00000001FF/i);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
