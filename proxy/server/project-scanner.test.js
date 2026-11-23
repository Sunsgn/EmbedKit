import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PROJECT_SCAN_LIMITS, scanProjectDirectory } from './project-scanner.js';

const withProject = async (files, callback) => {
  const root = await mkdtemp(join(tmpdir(), 'embedkit-scanner-adapter-'));
  try {
    await Promise.all(Object.entries(files).map(([name, content]) => writeFile(join(root, name), content)));
    await callback(root);
  } finally { await rm(root, { recursive: true, force: true }); }
};

test('recognizes a non-FreeRTOS project from explicit RT-Thread evidence', async () => {
  await withProject({ 'rtconfig.h': '#define RT_THREAD_PRIORITY_MAX 32', 'main.c': 'int main(void){}' }, async root => {
    const result = await scanProjectDirectory(root);
    assert.deepEqual(result.recognition.frameworks, ['RT-Thread']);
    assert.ok(result.recognition.evidence.some(item => item.path === 'rtconfig.h' && item.confidence === 'high'));
  });
});

test('unknown source projects degrade without guessing a chip, IDE, toolchain or RTOS', async () => {
  await withProject({ 'application.zig': 'pub fn main() void {}' }, async root => {
    const result = await scanProjectDirectory(root);
    assert.deepEqual(result.recognition.projectTypes, ['通用嵌入式源码工程']);
    assert.deepEqual(result.recognition.frameworks, []);
    assert.deepEqual(result.recognition.chipCandidates, []);
    assert.ok(result.recognition.unknowns.includes('框架/RTOS未识别'));
    assert.ok(result.recognition.unknowns.includes('芯片型号未识别'));
  });
});

test('caps caller-provided traversal limits at the public scanner limits', async () => {
  await withProject({ 'main.c': '' }, async root => {
    const result = await scanProjectDirectory(root, { maxFiles: Number.MAX_SAFE_INTEGER, maxDepth: Number.MAX_SAFE_INTEGER });
    assert.equal(result.inventory.maxFiles, PROJECT_SCAN_LIMITS.maxFiles);
    assert.equal(result.inventory.maxDepth, PROJECT_SCAN_LIMITS.maxDepth);
  });
});
