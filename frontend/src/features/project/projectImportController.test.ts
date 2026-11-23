import { describe, expect, it, vi } from 'vitest';
import type { EngineeringProject } from '../../types/product';
import { importProjectFiles, ProjectImportError } from './projectImportController';

function sourceFile(name: string, content = '', size = content.length, path = ''): File {
  return { name, size, lastModified: 1, webkitRelativePath: path, text: async () => content } as File;
}

const project = { id: 'project-1', name: 'Project One' } as EngineeringProject;
const standalone = (files: File[]) => ({ files, requestedProjectId: '', engineeringProject: null, recordRevision: vi.fn() });

describe('project import controller', () => {
  it.each([
    ['firmware.zip', 'zip_unsupported'],
    ['image.bin', 'no_supported_files'],
  ])('rejects unsupported input %s with a stable error code', async (name, code) => {
    await expect(importProjectFiles(standalone([sourceFile(name)]))).rejects.toMatchObject({ code });
  });

  it('enforces source, MAP, and aggregate size limits', async () => {
    await expect(importProjectFiles(standalone([sourceFile('main.c', '', 2 * 1024 * 1024 + 1)]))).rejects.toMatchObject({ code: 'file_too_large' });
    await expect(importProjectFiles(standalone([sourceFile('firmware.map', '', 20 * 1024 * 1024 + 1)]))).rejects.toMatchObject({ code: 'file_too_large' });
    const files = [sourceFile('a.map', '', 20 * 1024 * 1024), sourceFile('b.map', '', 20 * 1024 * 1024), sourceFile('c.map', '', 11 * 1024 * 1024)];
    await expect(importProjectFiles(standalone(files))).rejects.toBeInstanceOf(ProjectImportError);
    await expect(importProjectFiles(standalone(files))).rejects.toMatchObject({ code: 'total_too_large' });
  });

  it('converts supported files, preserves relative paths, and selects source code first', async () => {
    const result = await importProjectFiles(standalone([
      sourceFile('board.h', '#pragma once', 12, 'demo/include/board.h'),
      sourceFile('main.cpp', 'int main() {}', 13, 'demo/src/main.cpp'),
      sourceFile('ignored.bin'),
    ]));
    expect(result.projectName).toBe('demo');
    expect(result.activeFile).toBe('/demo/src/main.cpp');
    expect(result.files).toEqual([
      expect.objectContaining({ path: '/demo/include/board.h', language: 'h' }),
      expect.objectContaining({ path: '/demo/src/main.cpp', language: 'cpp' }),
    ]);
    expect(result.association).toBeNull();
  });

  it('reports file read failures without mistaking them for persistence failures', async () => {
    const unreadable = sourceFile('main.c');
    unreadable.text = async () => { throw new Error('access denied'); };
    await expect(importProjectFiles(standalone([unreadable]))).rejects.toMatchObject({
      code: 'read_failed',
      message: '工程文件读取失败：access denied',
    });
  });

  it('persists and records a deterministic project revision before returning it', async () => {
    const saveProject = vi.fn(async () => undefined), recordRevision = vi.fn(async () => undefined);
    const result = await importProjectFiles(
      { files: [sourceFile('main.c', 'main')], requestedProjectId: project.id, engineeringProject: project, recordRevision },
      { fingerprint: async () => 'f'.repeat(64), revisionId: async () => 'revision-1', now: () => '2026-01-01T00:00:00.000Z', saveProject },
    );
    expect(saveProject).toHaveBeenCalledWith(expect.objectContaining({ projectId: project.id, revisionId: 'revision-1', activeFile: '/main.c' }));
    expect(recordRevision).toHaveBeenCalledWith(project, 'revision-1', 'f'.repeat(64), '2026-01-01T00:00:00.000Z');
    expect(result.association).toEqual({ revisionId: 'revision-1', sourceFingerprint: 'f'.repeat(64), importedAt: '2026-01-01T00:00:00.000Z' });
  });
});
