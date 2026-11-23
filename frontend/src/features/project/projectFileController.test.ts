import { describe, expect, it } from 'vitest';
import type { FileNode } from '../../types';
import { PROJECT_WORKSPACE_MAX_FILES } from '../../services/workspaceStorage';
import { addProjectFile, deleteProjectFile, updateProjectFileContent } from './projectFileController';

const file = (path: string): FileNode => ({ name: path.split('/').pop()!, path, content: path, language: 'c' });

describe('project file controller', () => {
  it('adds nested relative files and selects the created file', () => {
    const result = addProjectFile([file('/main.c')], 'src\\worker.cpp');
    expect(result.activeFile).toBe('/src/worker.cpp');
    expect(result.file).toEqual({ name: 'worker.cpp', path: '/src/worker.cpp', content: '', language: 'cpp' });
  });

  it.each(['', '../secret.c', '/absolute.c', 'C:\\firmware\\main.c', 'src//main.c', 'bad?.c'])('rejects unsafe path %s', path => {
    expect(() => addProjectFile([], path)).toThrow(expect.objectContaining({ code: 'invalid_path' }));
  });

  it('rejects portable duplicate paths without changing letter case semantics', () => {
    expect(() => addProjectFile([file('/Src/Main.c')], 'src/main.c')).toThrow(expect.objectContaining({ code: 'duplicate_path' }));
  });

  it('enforces the persisted workspace file-count limit', () => {
    const files = Array.from({ length: PROJECT_WORKSPACE_MAX_FILES }, (_, index) => file(`/file-${index}.c`));
    expect(() => addProjectFile(files, 'overflow.c')).toThrow(expect.objectContaining({ code: 'limit_reached' }));
  });

  it('updates only the selected file content', () => {
    const files = [file('/a.c'), file('/b.c')];
    const updated = updateProjectFileContent(files, '/b.c', 'changed');
    expect(updated.map(item => item.content)).toEqual(['/a.c', 'changed']);
    expect(files[1].content).toBe('/b.c');
  });

  it('selects the next neighbor when deleting the active file', () => {
    const result = deleteProjectFile([file('/a.c'), file('/b.c'), file('/c.c')], '/a.c', '/a.c');
    expect(result.activeFile).toBe('/b.c');
    expect(result.files.map(item => item.path)).toEqual(['/b.c', '/c.c']);
  });

  it('selects the previous neighbor when deleting the last active file', () => {
    expect(deleteProjectFile([file('/a.c'), file('/b.c')], '/b.c', '/b.c').activeFile).toBe('/a.c');
  });

  it('keeps the active file when deleting another or unknown file', () => {
    expect(deleteProjectFile([file('/a.c'), file('/b.c')], '/a.c', '/b.c')).toMatchObject({ activeFile: '/a.c', removed: true });
    expect(deleteProjectFile([file('/a.c')], '/a.c', '/missing.c')).toMatchObject({ activeFile: '/a.c', removed: false });
  });
});
