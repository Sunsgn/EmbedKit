import { describe, expect, it } from 'vitest';
import type { FileNode } from '../../types';
import { resolveBuildDiagnosticFile, resolveMapModuleFile } from './sourceNavigationController';

const files: FileNode[] = [
  { name: 'main.c', path: '/src/main.c', content: '', language: 'c' },
  { name: 'startup.S', path: '/platform/startup.S', content: '', language: 'text' },
  { name: 'worker.cpp', path: '/app/worker.cpp', content: '', language: 'cpp' },
  { name: 'worker.h', path: '/app/worker.h', content: '', language: 'h' },
];

describe('project source navigation controller', () => {
  it.each([
    ['D:\\firmware\\src\\main.c', '/src/main.c'],
    ['src/main.c', '/src/main.c'],
    ['/workspace/app/worker.cpp', '/app/worker.cpp'],
  ])('matches build diagnostic path %s to %s', (diagnostic, expected) => {
    expect(resolveBuildDiagnosticFile(files, diagnostic)?.path).toBe(expected);
  });

  it('returns no target when a build diagnostic has no source evidence', () => {
    expect(resolveBuildDiagnosticFile(files, '/other/missing.c')).toBeNull();
  });

  it.each([
    ['build/main.o', '/src/main.c'],
    ['build\\worker.obj', '/app/worker.cpp'],
    ['libplatform.a(startup.o)', '/platform/startup.S'],
  ])('matches MAP module %s to source %s', (module, expected) => {
    expect(resolveMapModuleFile(files, module)?.path).toBe(expected);
  });

  it('ignores headers and unknown MAP objects', () => {
    expect(resolveMapModuleFile(files, 'worker.h')).toBeNull();
    expect(resolveMapModuleFile(files, 'missing.o')).toBeNull();
  });
});
