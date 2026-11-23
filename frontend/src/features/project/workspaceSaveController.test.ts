import { describe, expect, it, vi } from 'vitest';
import type { EngineeringProject } from '../../types/product';
import { saveEditorWorkspace } from './workspaceSaveController';

const files = [{ name: 'main.c', path: '/main.c', content: '', language: 'c' as const }];
const project = { id: 'project-1', name: 'Project One' } as EngineeringProject;
const base = { requestedProjectId: project.id, engineeringProject: project, revisionId: 'revision-1', sourceFingerprint: 'a'.repeat(64), importedAt: '2026-01-01T00:00:00.000Z', projectName: project.name, files, activeFile: '/main.c' };

describe('editor workspace save controller', () => {
  it('saves a fully identified project workspace without writing standalone data', async () => {
    const saveProject = vi.fn(async () => undefined), saveCurrent = vi.fn(async () => undefined);
    await expect(saveEditorWorkspace(base, { saveProject, saveCurrent })).resolves.toBe('project');
    expect(saveProject).toHaveBeenCalledWith(expect.objectContaining({ projectId: project.id, revisionId: 'revision-1', sourceFingerprint: 'a'.repeat(64) }));
    expect(saveCurrent).not.toHaveBeenCalled();
  });

  it('skips incomplete project associations instead of overwriting standalone data', async () => {
    const saveProject = vi.fn(async () => undefined), saveCurrent = vi.fn(async () => undefined);
    await expect(saveEditorWorkspace({ ...base, revisionId: '' }, { saveProject, saveCurrent })).resolves.toBe('skipped');
    expect(saveProject).not.toHaveBeenCalled();
    expect(saveCurrent).not.toHaveBeenCalled();
  });

  it('saves the independent workspace when no engineering project is requested', async () => {
    const saveProject = vi.fn(async () => undefined), saveCurrent = vi.fn(async () => undefined);
    await expect(saveEditorWorkspace({ ...base, requestedProjectId: '', engineeringProject: null }, { saveProject, saveCurrent })).resolves.toBe('standalone');
    expect(saveCurrent).toHaveBeenCalledWith({ name: project.name, files, activeFile: '/main.c' });
    expect(saveProject).not.toHaveBeenCalled();
  });
});
