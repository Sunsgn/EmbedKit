import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EngineeringProjectsPage from './EngineeringProjectsPage';
import { listEngineeringProjects, saveEngineeringProject } from '../services/productStorage';
import { getAgentStatus } from '../services/agentClient';
import { selectLocalDirectory, revokeLocalPath } from '../services/localFiles';
import { scanSelectedProject } from '../services/projectScan';

vi.mock('../services/productStorage', () => ({ deleteEngineeringProject: vi.fn(), listEngineeringProjects: vi.fn(), saveEngineeringProject: vi.fn() }));
vi.mock('../services/agentClient', async importOriginal => ({ ...(await importOriginal<typeof import('../services/agentClient')>()), getAgentStatus: vi.fn() }));
vi.mock('../services/localFiles', () => ({ selectLocalDirectory: vi.fn(), revokeLocalPath: vi.fn() }));
vi.mock('../services/projectScan', () => ({ scanSelectedProject: vi.fn() }));

const renderPage = () => render(<MemoryRouter><EngineeringProjectsPage /></MemoryRouter>);
const project = { schemaVersion: 4 as const, id: 'project-1', name: '控制器工程', productModel: 'EK-1', chipModel: 'Generic MCU', description: '', tags: [], features: [], environmentRequirements: [], resourceLinks: [], source: { kind: 'manual' as const, displayName: '' }, createdAt: '', updatedAt: '2026-10-15T00:00:00.000Z' };

describe('EngineeringProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listEngineeringProjects).mockResolvedValue([project]);
    vi.mocked(saveEngineeringProject).mockResolvedValue();
    vi.mocked(getAgentStatus).mockResolvedValue({ available: true, name: 'Agent', version: '1', protocolVersion: 1, uptimeSeconds: 1, capabilities: ['project-scan'], serialSessions: 0, networkSessions: 0, buildJobs: 0 });
    vi.mocked(revokeLocalPath).mockResolvedValue({ revoked: true });
  });

  it('shows project recognition as the primary workspace and keeps descriptive fields in details', async () => {
    renderPage();
    expect((await screen.findAllByText('控制器工程')).length).toBe(2);
    expect(screen.getByText('工程识别结果')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '说明与备注' }));
    expect(screen.getByDisplayValue('控制器工程')).toBeVisible();
    expect(screen.getByText('程序功能')).toBeVisible();
    expect(screen.getByText('可选环境备注')).toBeVisible();
    expect(screen.queryByText('测试设备')).not.toBeInTheDocument();
    expect(screen.queryByText('通道配置')).not.toBeInTheDocument();
  });

  it('does not create a fake default project when storage is empty', async () => {
    vi.mocked(listEngineeringProjects).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('从真实工程目录开始')).toBeVisible();
    expect(saveEngineeringProject).not.toHaveBeenCalled();
  });

  it('selects, scans and saves a real local project without persisting an absolute path', async () => {
    vi.mocked(listEngineeringProjects).mockResolvedValue([]);
    vi.mocked(selectLocalDirectory).mockResolvedValue({ cancelled: false, kind: 'directory', path: 'D:\\firmware', name: 'firmware', selectionId: 'selection-1' });
    vi.mocked(scanSelectedProject).mockResolvedValue({ schemaVersion: 1, rootName: 'firmware', durationMs: 12, recognition: { projectTypes: ['通用嵌入式源码工程'], frameworks: [], ides: [], toolchains: [], buildSystems: ['CMake'], chipCandidates: [], confidence: 1, evidence: [{ category: 'buildSystems', value: 'CMake', path: 'CMakeLists.txt', confidence: 'high', detail: '发现 CMakeLists.txt' }], unknowns: ['框架/RTOS未识别'] }, inventory: { scannedAt: '2026-10-15T01:00:00.000Z', fileCount: 2, directoryCount: 1, sourceFileCount: 1, configFileCount: 1, artifactCount: 0, maxFiles: 5000, maxDepth: 12, truncated: false, entries: [], warnings: [] }, artifacts: [] });
    renderPage();
    await screen.findByText('从真实工程目录开始');
    const button = screen.getAllByRole('button', { name: '选择本地工程目录' }).find(item => item.textContent?.includes('选择本地工程目录'))!;
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(saveEngineeringProject).toHaveBeenCalled());
    const saved = vi.mocked(saveEngineeringProject).mock.calls[0][0];
    expect(saved).toMatchObject({ name: 'firmware', schemaVersion: 4, source: { kind: 'local-directory', displayName: 'firmware' }, recognition: { buildSystems: ['CMake'] } });
    expect(JSON.stringify(saved)).not.toContain('D:\\firmware');
    expect(revokeLocalPath).toHaveBeenCalledWith('selection-1');
  });
});
