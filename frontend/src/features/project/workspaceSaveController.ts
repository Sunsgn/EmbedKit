import type { FileNode } from '../../types';
import type { EngineeringProject } from '../../types/product';
import { saveCurrentWorkspace, saveProjectWorkspace } from '../../services/workspaceStorage';

export interface SaveEditorWorkspaceInput {
  requestedProjectId: string;
  engineeringProject: EngineeringProject | null;
  revisionId: string;
  sourceFingerprint: string;
  importedAt: string;
  projectName: string;
  files: FileNode[];
  activeFile: string;
}

interface SaveWorkspaceDependencies {
  saveCurrent: typeof saveCurrentWorkspace;
  saveProject: typeof saveProjectWorkspace;
}

const defaultDependencies: SaveWorkspaceDependencies = { saveCurrent: saveCurrentWorkspace, saveProject: saveProjectWorkspace };

export async function saveEditorWorkspace(input: SaveEditorWorkspaceInput, overrides: Partial<SaveWorkspaceDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  if (!input.requestedProjectId) {
    await dependencies.saveCurrent({ name: input.projectName, files: input.files, activeFile: input.activeFile });
    return 'standalone' as const;
  }
  if (!input.engineeringProject || !input.revisionId || !input.sourceFingerprint || !input.importedAt) return 'skipped' as const;
  await dependencies.saveProject({
    schemaVersion: 1,
    projectId: input.requestedProjectId,
    revisionId: input.revisionId,
    name: input.engineeringProject.name,
    files: input.files,
    activeFile: input.activeFile,
    importedAt: input.importedAt,
    sourceFingerprint: input.sourceFingerprint,
  });
  return 'project' as const;
}
