import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { collectLocalModulePaths } from './portable-module-graph.mjs';

test('collects the complete local module graph without unrelated test files', t => {
  const root = mkdtempSync(join(tmpdir(), 'embedkit-portable-graph-'));
  mkdirSync(join(root, 'app', 'server'), { recursive: true });
  writeFileSync(join(root, 'app', 'entry.js'), "import { start } from './server/start.js';\nstart();\n");
  writeFileSync(join(root, 'app', 'server', 'start.js'), "export { value } from '../../contract.js';\n");
  writeFileSync(join(root, 'contract.js'), 'export const value = true;\n');
  writeFileSync(join(root, 'app', 'server', 'start.test.js'), 'throw new Error();\n');
  t.after(() => rmSync(root, { recursive: true, force: true }));

  assert.deepEqual(collectLocalModulePaths(root, ['app/entry.js']), [
    join('app', 'entry.js'),
    join('app', 'server', 'start.js'),
    'contract.js',
  ]);
});

test('reports a missing local dependency', t => {
  const root = mkdtempSync(join(tmpdir(), 'embedkit-portable-graph-missing-'));
  writeFileSync(join(root, 'entry.js'), "import './missing.js';\n");
  t.after(() => rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () => collectLocalModulePaths(root, ['entry.js']),
    /Portable package dependency not found/,
  );
});
