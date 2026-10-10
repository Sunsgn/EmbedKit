import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const html = await readFile(resolve(root, 'dist', 'index.html'), 'utf8');
const app = await readFile(resolve(root, 'src', 'App.tsx'), 'utf8');
const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
const localReferences = references.filter(value => value.startsWith('/'));

assert.ok(localReferences.length >= 3, 'Production HTML must reference favicon, JavaScript and CSS assets');
for (const reference of localReferences) assert.ok(reference.startsWith('/EmbedKit/'), `Root-relative asset is not under /EmbedKit/: ${reference}`);
assert.match(app, /HashRouter/, 'GitHub Pages build must use HashRouter or an explicitly verified equivalent');

for (const reference of localReferences) {
  const relative = reference.slice('/EmbedKit/'.length);
  assert.ok(relative && !relative.includes('..'), `Invalid production asset path: ${reference}`);
  await access(resolve(root, 'dist', relative));
}

console.log(`GitHub Pages build verified: ${localReferences.length} local references use /EmbedKit/ and exist.`);
