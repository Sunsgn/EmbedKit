import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EditorPage from './EditorPage';
import { createWorkspaceFingerprint, loadCurrentWorkspace, loadProjectWorkspace } from '../services/workspaceStorage';
import { listEngineeringProjects, listProjectAnalysisRuns, saveProjectAnalysisRun } from '../services/productStorage';

vi.mock('../components/CodeEditor', () => ({ default: () => <div data-testid="code-editor" /> }));
vi.mock('../features/project/ProjectBuildPanel', () => ({ default: () => null }));
vi.mock('../features/project/MapAnalysisPanel', () => ({ default: () => null }));
vi.mock('../features/project/ProjectArchitecturePanel', () => ({ default: () => null }));
vi.mock('../services/runtimeTraceStorage', () => ({ clearRuntimeTrace: vi.fn(), loadRuntimeTrace: vi.fn().mockResolvedValue(null), saveRuntimeTrace: vi.fn() }));
vi.mock('../services/workspaceStorage', () => ({
  copyLegacyWorkspaceToProject: vi.fn(),
  createProjectRevisionId: vi.fn(),
  createWorkspaceFingerprint: vi.fn(),
  loadCurrentWorkspace: vi.fn(),
  loadProjectWorkspace: vi.fn(),
  saveCurrentWorkspace: vi.fn(),
  saveProjectWorkspace: vi.fn(),
}));
vi.mock('../services/productStorage', () => ({ listEngineeringProjects: vi.fn(), listProjectAnalysisRuns: vi.fn().mockResolvedValue([]), saveProjectAnalysisRun: vi.fn(), saveProjectRevision: vi.fn() }));

const project = {
  schemaVersion: 4 as const,
  id: 'project-1',
  name: '通用控制器',
  productModel: '',
  chipModel: '',
  description: '',
  tags: [],
  features: [],
  environmentRequirements: [],
  resourceLinks: [],
  source: { kind: 'manual' as const, displayName: '' },
  createdAt: '2026-11-19T00:00:00.000Z',
  updatedAt: '2026-11-19T00:00:00.000Z',
};

const legacyWorkspace = {
  id: 'current',
  name: '其他工程',
  files: [{ name: 'legacy.c', path: '/legacy.c', content: 'legacy secret', language: 'c' as const }],
  activeFile: '/legacy.c',
  updatedAt: '2026-11-19T00:00:00.000Z',
};

const renderProject = () => render(<MemoryRouter initialEntries={['/projects?projectId=project-1']}><EditorPage /></MemoryRouter>);

describe('EditorPage project workspace routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listEngineeringProjects).mockResolvedValue([project]);
    vi.mocked(loadCurrentWorkspace).mockResolvedValue(legacyWorkspace);
    vi.mocked(loadProjectWorkspace).mockResolvedValue(null);
    vi.mocked(listProjectAnalysisRuns).mockResolvedValue([]);
    vi.mocked(createWorkspaceFingerprint).mockResolvedValue('1'.repeat(64));
  });

  it('loads only the workspace belonging to the project id and requires explicit legacy association', async () => {
    renderProject();

    await waitFor(() => expect(loadProjectWorkspace).toHaveBeenCalledWith('project-1'));
    expect(await screen.findByText('当前工程尚未关联源码工作区，请导入工程目录；不会自动加载其他工程的源码。')).toBeVisible();
    expect(screen.getByRole('button', { name: '复制并关联旧工作区' })).toBeVisible();
    expect(screen.queryByText('legacy secret')).not.toBeInTheDocument();
  });

  it('reports a deleted project instead of falling back to the global workspace', async () => {
    vi.mocked(listEngineeringProjects).mockResolvedValue([]);
    renderProject();

    expect(await screen.findByText('工程档案不存在或已删除，请返回工程中心重新选择')).toBeVisible();
    expect(loadProjectWorkspace).not.toHaveBeenCalled();
  });

  it('restores revision metadata from the matching project workspace', async () => {
    vi.mocked(loadProjectWorkspace).mockResolvedValue({
      schemaVersion: 1,
      id: 'project:project-1',
      projectId: 'project-1',
      revisionId: 'revision:0123456789abcdef',
      name: project.name,
      files: [{ name: 'main.c', path: '/main.c', content: 'int main(void) {}', language: 'c' }],
      activeFile: '/main.c',
      importedAt: '2026-11-19T00:00:00.000Z',
      sourceFingerprint: '0'.repeat(64),
      updatedAt: '2026-11-19T00:00:00.000Z',
    });
    renderProject();

    expect(await screen.findByText('当前工程：通用控制器')).toBeVisible();
    expect(await screen.findByText('修订 0123456789ab')).toBeVisible();
  });

  it('saves deterministic analysis evidence against the active project revision', async () => {
    vi.mocked(loadProjectWorkspace).mockResolvedValue({
      schemaVersion: 1, id: 'project:project-1', projectId: 'project-1', revisionId: 'revision:0123456789abcdef', name: project.name,
      files: [{ name: 'main.c', path: '/main.c', content: 'int main(void) { return 0; }', language: 'c' }], activeFile: '/main.c',
      importedAt: '2026-11-19T00:00:00.000Z', sourceFingerprint: '0'.repeat(64), updatedAt: '2026-11-19T00:00:00.000Z',
    });
    renderProject();
    const button = await screen.findByRole('button', { name: '保存分析证据' });
    await waitFor(() => expect(button).toBeEnabled());

    fireEvent.click(button);

    await waitFor(() => expect(saveProjectAnalysisRun).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-1', projectRevisionId: 'revision:0123456789abcdef', sourceFingerprint: '0'.repeat(64), inputFingerprint: '1'.repeat(64), dirty: true, status: 'completed' })));
    expect(await screen.findByRole('button', { name: '导出分析报告' })).toBeVisible();
  });
});
