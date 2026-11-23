import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFileSelectionService } from './file-selection-service.js';

test('file selections expire, enforce kind and evict the oldest bounded entry', async () => {
  const root = await mkdtemp(join(tmpdir(), 'embedkit-selections-'));
  let timestamp = 1000;
  try {
    const first = join(root, 'first.bin'), second = join(root, 'second.bin');
    await writeFile(first, Buffer.from([1])); await writeFile(second, Buffer.from([2]));
    const service = createFileSelectionService({ picker: { select: async () => ({ cancelled: true }) }, maxSelections: 1, ttlMs: 10, now: () => timestamp });
    const selectedFirst = service.createSelection('file', first, await stat(first));
    assert.throws(() => service.getSelection(selectedFirst.selectionId, 'directory'), /not a directory/);
    const selectedSecond = service.createSelection('file', second, await stat(second));
    assert.throws(() => service.getSelection(selectedFirst.selectionId), /missing or expired/);
    timestamp = 1011;
    assert.throws(() => service.getSelection(selectedSecond.selectionId), /missing or expired/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('file selection service rejects concurrent system pickers and releases the lock after cancellation', async () => {
  let release;
  const picker = { select: () => new Promise(resolve => { release = resolve; }) };
  const service = createFileSelectionService({ picker });
  const first = service.selectPath({ kind: 'file' });
  await assert.rejects(service.selectPath({ kind: 'file' }), /already open/);
  release({ cancelled: true });
  assert.deepEqual(await first, { cancelled: true, kind: 'file' });
});
