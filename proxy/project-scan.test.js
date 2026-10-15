import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanProjectDirectory } from './proxy.js';

test('scans a real project tree and reports deterministic evidence and artifacts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'embedkit-project-scan-'));
  try {
    await mkdir(join(root, 'src'));
    await mkdir(join(root, 'build'));
    await writeFile(join(root, 'CMakeLists.txt'), 'project(sample)');
    await writeFile(join(root, 'FreeRTOSConfig.h'), '#define configUSE_PREEMPTION 1');
    await writeFile(join(root, 'board.ioc'), 'board config');
    await writeFile(join(root, 'src', 'main.c'), 'int main(void) { return 0; }');
    await writeFile(join(root, 'firmware.bin'), Buffer.from([1, 2, 3]));
    await writeFile(join(root, 'build', 'ignored.map'), 'must not be scanned');

    const result = await scanProjectDirectory(root);

    assert.equal(result.schemaVersion, 1);
    assert.equal(result.inventory.fileCount, 5);
    assert.equal(result.inventory.sourceFileCount, 1);
    assert.equal(result.inventory.configFileCount, 3);
    assert.deepEqual(result.recognition.buildSystems, ['CMake']);
    assert.deepEqual(result.recognition.frameworks, ['FreeRTOS']);
    assert.ok(result.recognition.evidence.some(item => item.path === 'FreeRTOSConfig.h' && item.confidence === 'high'));
    assert.deepEqual(result.artifacts.map(item => ({ path: item.path, kind: item.kind, byteLength: item.byteLength })), [{ path: 'firmware.bin', kind: 'bin', byteLength: 3 }]);
    assert.ok(result.recognition.unknowns.includes('工具链未识别'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('uses bounded traversal and does not follow symbolic links', async context => {
  const root = await mkdtemp(join(tmpdir(), 'embedkit-project-limit-'));
  try {
    await writeFile(join(root, 'a.c'), '');
    await writeFile(join(root, 'b.c'), '');
    try { await symlink(root, join(root, 'loop'), 'dir'); } catch { context.diagnostic('symbolic link creation is unavailable; limit behavior is still verified'); }

    const result = await scanProjectDirectory(root, { maxFiles: 1, maxDepth: 1 });

    assert.equal(result.inventory.fileCount, 1);
    assert.equal(result.inventory.truncated, true);
    assert.ok(result.inventory.entries.length <= 800);
  } finally { await rm(root, { recursive: true, force: true }); }
});
