import type { FileNode } from '../../types';

function normalizedPath(value: string) {
  return value.replace(/\\/g, '/').toLowerCase();
}

export function resolveBuildDiagnosticFile(files: readonly FileNode[], diagnosticFile: string): FileNode | null {
  const diagnosticPath = normalizedPath(diagnosticFile);
  return files.find(file => {
    const sourcePath = normalizedPath(file.path);
    return diagnosticPath.endsWith(sourcePath.replace(/^\//, ''))
      || sourcePath.endsWith(diagnosticPath.replace(/^\//, ''));
  }) ?? null;
}

export function resolveMapModuleFile(files: readonly FileNode[], module: string): FileNode | null {
  const normalized = module.replace(/\\/g, '/');
  const nestedObject = normalized.match(/\(([^()]+\.(?:o|obj))\)/i)?.[1];
  const objectName = (nestedObject || normalized.split('/').pop() || normalized)
    .replace(/\.(?:o|obj)$/i, '')
    .toLowerCase();
  return files.find(file => /\.(c|cc|cpp|s|S)$/i.test(file.name)
    && file.name.replace(/\.[^.]+$/, '').toLowerCase() === objectName) ?? null;
}
