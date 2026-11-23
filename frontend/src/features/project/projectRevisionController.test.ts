import { describe, expect, it, vi } from 'vitest';
import type { ProjectWorkspace } from '../../services/workspaceStorage';
import type { EngineeringProject } from '../../types/product';
import {
  associateLegacyProjectWorkspace,
  projectRevisionSource,
  recordProjectSourceRevision,
} from './projectRevisionController';

function project(source?: EngineeringProject['source']): EngineeringProject {
  return { id: 'project-1', name: 'Project One', source } as EngineeringProject;
}

const workspace = {
  schemaVersion: 1,
  id: 'project:project-1',
  projectId: 'project-1',
  revisionId: 'revision-1',
  name: 'Project One',
  files: [{ name: 'main.c', path: '/main.c', content: '', language: 'c' }],
  activeFile: '/main.c',
  importedAt: '2026-01-01T00:00:00.000Z',
  sourceFingerprint: 'a'.repeat(64),
  updatedAt: '2026-01-01T00:00:00.000Z',
} as ProjectWorkspace;

describe('project revision controller', () => {
  it.each([
    ['local-directory', 'directory'],
    ['archive', 'archive'],
    ['manual', 'manual'],
  ] as const)('maps %s project sources to %s revision evidence', (kind, expected) => {
    expect(projectRevisionSource(project({ kind, displayName: '' }))).toBe(expected);
  });

  it('degrades missing source metadata to a manual revision', () => {
    expect(projectRevisionSource(project())).toBe('manual');
  });

  it('records a traceable immutable source revision', async () => {
    const saveRevision = vi.fn(async () => undefined), current = project({ kind: 'archive', displayName: 'source.zip' });
    await recordProjectSourceRevision({ project: current, revisionId: workspace.revisionId, sourceFingerprint: workspace.sourceFingerprint, capturedAt: workspace.importedAt }, { saveRevision });
    expect(saveRevision).toHaveBeenCalledWith({
      schemaVersion: 1,
      id: workspace.revisionId,
      projectId: current.id,
      source: 'archive',
      capturedAt: workspace.importedAt,
      label: 'Project One 源码导入',
      sourceSha256: workspace.sourceFingerprint,
      dirty: false,
    });
  });

  it('copies legacy data before recording its project revision', async () => {
    const copyLegacyWorkspace = vi.fn(async () => workspace), saveRevision = vi.fn(async () => undefined);
    await expect(associateLegacyProjectWorkspace('project-1', project(), { copyLegacyWorkspace, saveRevision })).resolves.toBe(workspace);
    expect(copyLegacyWorkspace).toHaveBeenCalledWith('project-1', 'Project One');
    expect(copyLegacyWorkspace.mock.invocationCallOrder[0]).toBeLessThan(saveRevision.mock.invocationCallOrder[0]);
    expect(saveRevision).toHaveBeenCalledWith(expect.objectContaining({ id: workspace.revisionId, sourceSha256: workspace.sourceFingerprint }));
  });

  it('does not create revision evidence when no legacy workspace exists', async () => {
    const copyLegacyWorkspace = vi.fn(async () => null), saveRevision = vi.fn(async () => undefined);
    await expect(associateLegacyProjectWorkspace('project-1', project(), { copyLegacyWorkspace, saveRevision })).resolves.toBeNull();
    expect(saveRevision).not.toHaveBeenCalled();
  });
});
