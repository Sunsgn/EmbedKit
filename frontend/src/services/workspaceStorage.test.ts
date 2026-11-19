import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { FileNode } from '../types';
import {
  PROJECT_WORKSPACE_MAX_FILES,
  copyLegacyWorkspaceToProject,
  createProjectRevisionId,
  createWorkspaceFingerprint,
  loadCurrentWorkspace,
  loadProjectWorkspace,
  saveCurrentWorkspace,
  saveProjectWorkspace,
} from './workspaceStorage';

const file = (path: string, content: string): FileNode => ({
  name: path.split('/').pop() || path,
  path,
  content,
  language: 'c',
});

const deleteDatabase = () => new Promise<void>((resolve) => {
  const request = indexedDB.deleteDatabase('embedkit-workspaces');
  request.onsuccess = request.onerror = request.onblocked = () => resolve();
});

describe('project workspace storage', () => {
  afterEach(deleteDatabase);

  it('isolates source workspaces by stable project id', async () => {
    const firstFiles = [file('/src/main.c', 'int first;')];
    const secondFiles = [file('/src/main.c', 'int second;')];
    const firstFingerprint = await createWorkspaceFingerprint(firstFiles);
    const secondFingerprint = await createWorkspaceFingerprint(secondFiles);

    await saveProjectWorkspace({ schemaVersion: 1, projectId: 'project-a', revisionId: 'revision:a', name: 'A', files: firstFiles, activeFile: '/src/main.c', importedAt: '2026-11-19T00:00:00.000Z', sourceFingerprint: firstFingerprint });
    await saveProjectWorkspace({ schemaVersion: 1, projectId: 'project-b', revisionId: 'revision:b', name: 'B', files: secondFiles, activeFile: '/src/main.c', importedAt: '2026-11-19T00:00:00.000Z', sourceFingerprint: secondFingerprint });

    expect((await loadProjectWorkspace('project-a'))?.files[0].content).toBe('int first;');
    expect((await loadProjectWorkspace('project-b'))?.files[0].content).toBe('int second;');
  });

  it('creates an order-independent SHA-256 fingerprint that changes with content', async () => {
    const first = file('/a.c', 'a');
    const second = file('/b.c', 'b');
    const fingerprint = await createWorkspaceFingerprint([first, second]);

    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(await createWorkspaceFingerprint([second, first])).toBe(fingerprint);
    expect(await createWorkspaceFingerprint([first, { ...second, content: 'changed' }])).not.toBe(fingerprint);
  });

  it('creates repeatable revision ids without collisions between projects', async () => {
    const fingerprint = await createWorkspaceFingerprint([file('/main.c', 'same source')]);
    const first = await createProjectRevisionId('project-a', fingerprint);

    expect(first).toBe(await createProjectRevisionId('project-a', fingerprint));
    expect(first).not.toBe(await createProjectRevisionId('project-b', fingerprint));
    expect(first).toMatch(/^revision:[0-9a-f]{64}$/);
  });

  it('copies a legacy workspace without deleting the original', async () => {
    await saveCurrentWorkspace({ name: 'Legacy', files: [file('/main.c', 'int main(void) {}')], activeFile: '/missing.c' });

    const copied = await copyLegacyWorkspaceToProject('project-copy', 'Copied project');

    expect(copied).toMatchObject({ projectId: 'project-copy', name: 'Copied project', activeFile: '/main.c' });
    expect(await loadCurrentWorkspace()).toMatchObject({ name: 'Legacy' });
    expect(await loadProjectWorkspace('project-copy')).toMatchObject({ projectId: 'project-copy' });
  });

  it('rejects invalid ids and bounded-file violations', async () => {
    await expect(loadProjectWorkspace('../outside')).rejects.toThrow('工程 ID 无效');
    const files = Array.from({ length: PROJECT_WORKSPACE_MAX_FILES + 1 }, (_, index) => file(`/f${index}.c`, ''));
    await expect(createWorkspaceFingerprint(files)).rejects.toThrow(`最多保存 ${PROJECT_WORKSPACE_MAX_FILES} 个文件`);
  });
});
