import type { ProjectRevisionSource } from '../../types/lifecycle';
import { PROJECT_REVISION_SCHEMA_VERSION } from '../../types/lifecycle';
import type { EngineeringProject } from '../../types/product';
import { saveProjectRevision } from '../../services/productStorage';
import { copyLegacyWorkspaceToProject } from '../../services/workspaceStorage';

export interface RecordProjectSourceRevisionInput {
  project: EngineeringProject;
  revisionId: string;
  sourceFingerprint: string;
  capturedAt: string;
}

interface ProjectRevisionDependencies {
  saveRevision: typeof saveProjectRevision;
  copyLegacyWorkspace: typeof copyLegacyWorkspaceToProject;
}

const defaultDependencies: ProjectRevisionDependencies = {
  saveRevision: saveProjectRevision,
  copyLegacyWorkspace: copyLegacyWorkspaceToProject,
};

export function projectRevisionSource(project: EngineeringProject): ProjectRevisionSource {
  if (project.source?.kind === 'local-directory') return 'directory';
  if (project.source?.kind === 'archive') return 'archive';
  return 'manual';
}

export async function recordProjectSourceRevision(
  input: RecordProjectSourceRevisionInput,
  overrides: Partial<ProjectRevisionDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  await dependencies.saveRevision({
    schemaVersion: PROJECT_REVISION_SCHEMA_VERSION,
    id: input.revisionId,
    projectId: input.project.id,
    source: projectRevisionSource(input.project),
    capturedAt: input.capturedAt,
    label: `${input.project.name} 源码导入`,
    sourceSha256: input.sourceFingerprint,
    dirty: false,
  });
}

export async function associateLegacyProjectWorkspace(
  projectId: string,
  project: EngineeringProject,
  overrides: Partial<ProjectRevisionDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const workspace = await dependencies.copyLegacyWorkspace(projectId, project.name);
  if (!workspace) return null;
  await recordProjectSourceRevision({
    project,
    revisionId: workspace.revisionId,
    sourceFingerprint: workspace.sourceFingerprint,
    capturedAt: workspace.importedAt,
  }, dependencies);
  return workspace;
}
