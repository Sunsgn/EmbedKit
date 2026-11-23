import { describe, expect, it, vi } from 'vitest';
import type { EngineeringProject } from '../../types/product';
import type { ProjectAnalysisRun } from '../../types/projectAnalysis';
import type { ProjectWorkspace, StoredWorkspace } from '../../services/workspaceStorage';
import { loadEditorWorkspace } from './workspaceController';

const files = [{ name: 'main.c', path: '/main.c', content: '', language: 'c' as const }];
const project = { id: 'project-1', name: 'Project One' } as EngineeringProject;
const workspace = { projectId: project.id, files, activeFile: '/missing.c', revisionId: 'revision-1', sourceFingerprint: 'a'.repeat(64), importedAt: '2026-01-01T00:00:00.000Z' } as ProjectWorkspace;
const legacy = { name: 'Legacy', files, activeFile: '/main.c' } as StoredWorkspace;
const runs = [{ id: 'run-1', projectId: project.id }, { id: 'run-other', projectId: 'other' }] as ProjectAnalysisRun[];

describe('editor workspace controller', () => {
  it('loads only the requested project workspace and its analysis history', async () => {
    const result = await loadEditorWorkspace(project.id, {
      listProjects: async () => [project], loadProjectWorkspace: async () => workspace,
      loadCurrentWorkspace: async () => legacy, listAnalysisRuns: async () => runs,
    });
    expect(result.mode).toBe('project');
    if (result.mode !== 'project') return;
    expect(result.project).toBe(project);
    expect(result.activeFile).toBe('/main.c');
    expect(result.legacyAvailable).toBe(true);
    expect(result.analysisRuns.map(run => run.id)).toEqual(['run-1']);
    expect(result.message).toBe('');
  });

  it('does not fall back to unrelated legacy source when a project has no workspace', async () => {
    const result = await loadEditorWorkspace(project.id, {
      listProjects: async () => [project], loadProjectWorkspace: async () => null,
      loadCurrentWorkspace: async () => legacy, listAnalysisRuns: async () => runs,
    });
    expect(result.mode).toBe('project');
    if (result.mode !== 'project') return;
    expect(result.workspace).toBeNull();
    expect(result.activeFile).toBe('');
    expect(result.message).toContain('不会自动加载其他工程');
  });

  it('rejects invalid or missing project identities before reading project data', async () => {
    const listProjects = vi.fn(async () => [project]);
    await expect(loadEditorWorkspace('../unsafe', { listProjects })).rejects.toThrow('无效 ID');
    expect(listProjects).not.toHaveBeenCalled();
    await expect(loadEditorWorkspace('missing', { listProjects })).rejects.toThrow('不存在或已删除');
  });
});
