import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const html = await readFile(resolve(root, 'dist', 'index.html'), 'utf8');
const app = await readFile(resolve(root, 'src', 'App.tsx'), 'utf8');
const manifest = JSON.parse(await readFile(resolve(root, 'dist', 'manifest.webmanifest'), 'utf8'));
const serviceWorker = await readFile(resolve(root, 'dist', 'sw.js'), 'utf8');
const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
const localReferences = references.filter(value => value.startsWith('/'));

assert.ok(localReferences.length >= 3, 'Production HTML must reference favicon, JavaScript and CSS assets');
for (const reference of localReferences) assert.ok(reference.startsWith('/EmbedKit/'), `Root-relative asset is not under /EmbedKit/: ${reference}`);
assert.match(app, /HashRouter/, 'GitHub Pages build must use HashRouter or an explicitly verified equivalent');
assert.equal(manifest.start_url, '/EmbedKit/', 'PWA start URL must use the Pages subpath');
assert.equal(manifest.scope, '/EmbedKit/', 'PWA scope must use the Pages subpath');
assert.match(serviceWorker, /embedkit-shell-v1/, 'Service worker cache must be explicitly versioned');
assert.match(serviceWorker, /request\.mode === 'navigate'/, 'Service worker must provide an offline navigation fallback');
assert.match(serviceWorker, /caches\.keys\(\)/, 'Service worker must inspect old caches during activation');
assert.match(serviceWorker, /caches\.delete/, 'Service worker must remove obsolete versioned caches');
assert.match(serviceWorker, /pathname\.startsWith\(`\$\{scope\.pathname\}api\/`\)/, 'Service worker must exclude local API requests from caching');

for (const reference of localReferences) {
  const relative = reference.slice('/EmbedKit/'.length);
  assert.ok(relative && !relative.includes('..'), `Invalid production asset path: ${reference}`);
  await access(resolve(root, 'dist', relative));
}

console.log(`GitHub Pages build verified: ${localReferences.length} local references use /EmbedKit/ and exist.`);
