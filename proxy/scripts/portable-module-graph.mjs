import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';

const LOCAL_IMPORT_PATTERN = /(?:from\s+|import\s*(?:\(\s*)?)['"](\.{1,2}\/[^'"]+)['"]/g;
const MODULE_EXTENSIONS = ['', '.js', '.mjs', '.cjs', '.json'];

function resolveLocalModule(importer, specifier) {
  const base = resolve(dirname(importer), specifier);
  for (const extension of MODULE_EXTENSIONS) {
    const candidate = `${base}${extension}`;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  for (const extension of MODULE_EXTENSIONS.slice(1)) {
    const candidate = resolve(base, `index${extension}`);
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`Portable package dependency not found: ${specifier} imported by ${importer}`);
}

export function collectLocalModulePaths(root, entryPaths) {
  const sourceRoot = resolve(root);
  const pending = entryPaths.map(entry => resolve(sourceRoot, entry));
  const collected = new Set();

  while (pending.length > 0) {
    const modulePath = pending.pop();
    const moduleRelative = relative(sourceRoot, modulePath);
    if (moduleRelative.startsWith('..') || resolve(sourceRoot, moduleRelative) !== modulePath) {
      throw new Error(`Portable package dependency escapes source root: ${modulePath}`);
    }
    if (collected.has(moduleRelative)) continue;
    if (!existsSync(modulePath) || !statSync(modulePath).isFile()) {
      throw new Error(`Portable package entry not found: ${modulePath}`);
    }

    collected.add(moduleRelative);
    if (extname(modulePath) === '.json') continue;
    const source = readFileSync(modulePath, 'utf8');
    for (const match of source.matchAll(LOCAL_IMPORT_PATTERN)) {
      pending.push(resolveLocalModule(modulePath, match[1]));
    }
  }

  return [...collected].sort();
}
