import type { EngineeringProject } from '../../types/product';
import type { ProjectAnalysisRun } from '../../types/projectAnalysis';
import { listEngineeringProjects, listProjectAnalysisRuns } from '../../services/productStorage';
import { loadCurrentWorkspace, loadProjectWorkspace, type ProjectWorkspace, type StoredWorkspace } from '../../services/workspaceStorage';

interface WorkspaceDependencies {
  listProjects: () => Promise<EngineeringProject[]>;
  listAnalysisRuns: () => Promise<ProjectAnalysisRun[]>;
  loadProjectWorkspace: (projectId: string) => Promise<ProjectWorkspace | null>;
  loadCurrentWorkspace: () => Promise<StoredWorkspace | null>;
}

const defaultDependencies: WorkspaceDependencies = {
  listProjects: listEngineeringProjects,
  listAnalysisRuns: listProjectAnalysisRuns,
  loadProjectWorkspace,
  loadCurrentWorkspace,
};

const activePath = (workspace: StoredWorkspace) => workspace.files.some(file => file.path === workspace.activeFile) ? workspace.activeFile : workspace.files[0]?.path ?? '';

export type LoadedEditorWorkspace =
  | { mode: 'project'; project: EngineeringProject; workspace: ProjectWorkspace | null; activeFile: string; legacyAvailable: boolean; analysisRuns: ProjectAnalysisRun[]; message: string }
  | { mode: 'standalone'; workspace: StoredWorkspace | null; activeFile: string };

export async function loadEditorWorkspace(requestedProjectId: string, overrides: Partial<WorkspaceDependencies> = {}): Promise<LoadedEditorWorkspace> {
  const dependencies = { ...defaultDependencies, ...overrides };
  if (!requestedProjectId) {
    const workspace = await dependencies.loadCurrentWorkspace();
    return { mode: 'standalone', workspace: workspace?.files.length ? workspace : null, activeFile: workspace?.files.length ? activePath(workspace) : '' };
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(requestedProjectId)) throw new Error('工程链接包含无效 ID，请返回工程中心重新进入');
  const projects = await dependencies.listProjects(), project = projects.find(item => item.id === requestedProjectId);
  if (!project) throw new Error('工程档案不存在或已删除，请返回工程中心重新选择');
  const [workspace, legacy, storedAnalysisRuns] = await Promise.all([
    dependencies.loadProjectWorkspace(requestedProjectId),
    dependencies.loadCurrentWorkspace(),
    dependencies.listAnalysisRuns(),
  ]);
  const usableWorkspace = workspace?.files.length ? workspace : null;
  return {
    mode: 'project', project, workspace: usableWorkspace, activeFile: usableWorkspace ? activePath(usableWorkspace) : '',
    legacyAvailable: Boolean(legacy?.files.length), analysisRuns: storedAnalysisRuns.filter(run => run.projectId === requestedProjectId),
    message: usableWorkspace ? '' : '当前工程尚未关联源码工作区，请导入工程目录；不会自动加载其他工程的源码。',
  };
}
