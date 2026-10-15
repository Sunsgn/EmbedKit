import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DevelopmentEnvironmentPage from './DevelopmentEnvironmentPage';
import { AgentClientError, getAgentStatus } from '../services/agentClient';
import { createSoftwareInstallJob, getSoftwareInstallJob, listSoftwareInstallManifests, scanDevelopmentSoftware } from '../services/developmentEnvironment';
import { revokeLocalPath, selectLocalDirectory } from '../services/localFiles';
import { listEngineeringProjects } from '../services/productStorage';

vi.mock('../services/agentClient', async importOriginal => {
  const original = await importOriginal<typeof import('../services/agentClient')>();
  return { ...original, getAgentStatus: vi.fn() };
});
vi.mock('../services/developmentEnvironment', async importOriginal => {
  const original = await importOriginal<typeof import('../services/developmentEnvironment')>();
  return { ...original, scanDevelopmentSoftware: vi.fn(), listSoftwareInstallManifests: vi.fn(), createSoftwareInstallJob: vi.fn(), getSoftwareInstallJob: vi.fn(), cancelSoftwareInstallJob: vi.fn() };
});
vi.mock('../services/productStorage', () => ({ listEngineeringProjects: vi.fn() }));
vi.mock('../services/localFiles', () => ({ selectLocalDirectory: vi.fn(), revokeLocalPath: vi.fn() }));

const project = {
  schemaVersion: 3 as const, id: 'p1', name: '控制器', productModel: '', chipModel: '', description: '', tags: [], features: [], resourceLinks: [], createdAt: '', updatedAt: '2026-10-14T00:00:00.000Z',
  environmentRequirements: [{ id: 'r1', capabilityId: 'build.cmake', displayName: 'CMake', versionRange: '>=3.28', optional: false, source: 'user' as const, evidence: 'CMakeLists.txt' }],
};
const ninjaProject = { ...project, environmentRequirements: [{ ...project.environmentRequirements[0], capabilityId: 'build.ninja', displayName: 'Ninja', versionRange: '>=1.12' }] };
const manifest = { id: 'ninja-1.12.1-win32-x64', softwareId: 'build.ninja', capabilityId: 'build.ninja', name: 'Ninja', version: '1.12.1', platform: 'win32', architecture: 'x64', sourceUrl: 'https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-win.zip', officialPage: 'https://github.com/ninja-build/ninja/releases/tag/v1.12.1', byteLength: 275425, license: 'Apache-2.0', requiresLicenseAcceptance: false, archive: 'zip' as const, verifiedAt: '2026-10-14' };
const runningJob = { id: 'job-1', manifestId: manifest.id, softwareId: 'build.ninja', name: 'Ninja', version: '1.12.1', state: 'running' as const, progress: 10, startedAt: '', finishedAt: '', cancelRequested: false, events: [], error: '' };

describe('DevelopmentEnvironmentPage', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(listEngineeringProjects).mockResolvedValue([project]); vi.mocked(revokeLocalPath).mockResolvedValue({ revoked: true }); });

  it('shows actual detected software and a satisfied project requirement', async () => {
    vi.mocked(getAgentStatus).mockResolvedValue({ available: true, name: 'Agent', version: '1', protocolVersion: 1, uptimeSeconds: 1, capabilities: ['software-environment'], serialSessions: 0, networkSessions: 0, buildJobs: 0 });
    vi.mocked(scanDevelopmentSoftware).mockResolvedValue({ schemaVersion: 1, platform: 'win32', architecture: 'x64', detectedAt: '', unavailable: [], installations: [{ id: 'cmake', capabilityId: 'build.cmake', name: 'CMake', available: true, executable: 'cmake', version: '3.30.5', rawVersion: 'cmake version 3.30.5', detection: 'path-command', durationMs: 2 }] });
    render(<DevelopmentEnvironmentPage />);
    await waitFor(() => expect(screen.getByText('所有可核验的必需环境均已满足')).toBeVisible());
    expect(screen.getByText('3.30.5')).toBeVisible();
    expect(screen.getByText('满足')).toBeVisible();
  });

  it('degrades only local detection when the Agent is offline', async () => {
    vi.mocked(getAgentStatus).mockRejectedValue(new AgentClientError('offline', '无法连接本地助手'));
    render(<DevelopmentEnvironmentPage />);
    await waitFor(() => expect(screen.getByText('本地助手未连接')).toBeVisible());
    expect(screen.getByText(/工程档案、资料、教程和纯浏览器工具仍可使用/)).toBeVisible();
  });

  it('offers only a pinned manifest and keeps cancellation non-destructive', async () => {
    vi.mocked(listEngineeringProjects).mockResolvedValue([ninjaProject]);
    vi.mocked(getAgentStatus).mockResolvedValue({ available: true, name: 'Agent', version: '1', protocolVersion: 1, uptimeSeconds: 1, capabilities: ['software-environment', 'software-installation'], serialSessions: 0, networkSessions: 0, buildJobs: 0 });
    vi.mocked(scanDevelopmentSoftware).mockResolvedValue({ schemaVersion: 1, platform: 'win32', architecture: 'x64', detectedAt: '', unavailable: [], installations: [] });
    vi.mocked(listSoftwareInstallManifests).mockResolvedValue([manifest]);
    vi.mocked(selectLocalDirectory).mockResolvedValue({ cancelled: true, kind: 'directory' });
    render(<DevelopmentEnvironmentPage />);
    const button = await screen.findByRole('button', { name: /选择目录并安装/ }); fireEvent.click(button);
    expect(await screen.findByText('未选择安装目录，未进行任何更改。')).toBeVisible();
    expect(createSoftwareInstallJob).not.toHaveBeenCalled();
  });

  it('confirms installation, polls the job and rescans after verification', async () => {
    vi.mocked(listEngineeringProjects).mockResolvedValue([ninjaProject]);
    vi.mocked(getAgentStatus).mockResolvedValue({ available: true, name: 'Agent', version: '1', protocolVersion: 1, uptimeSeconds: 1, capabilities: ['software-environment', 'software-installation'], serialSessions: 0, networkSessions: 0, buildJobs: 0 });
    vi.mocked(scanDevelopmentSoftware).mockResolvedValue({ schemaVersion: 1, platform: 'win32', architecture: 'x64', detectedAt: '', unavailable: [], installations: [] });
    vi.mocked(listSoftwareInstallManifests).mockResolvedValue([manifest]);
    vi.mocked(selectLocalDirectory).mockResolvedValue({ cancelled: false, kind: 'directory', path: 'D:\\Tools', selectionId: 'selection-1' });
    vi.mocked(createSoftwareInstallJob).mockResolvedValue(runningJob);
    vi.mocked(getSoftwareInstallJob).mockResolvedValue({ ...runningJob, state: 'passed', progress: 100, finishedAt: 'now', installPath: 'D:\\Tools\\ninja\\1.12.1', events: [{ time: 'now', level: 'info', message: '安装完成并验证版本 1.12.1' }] });
    render(<DevelopmentEnvironmentPage />);
    fireEvent.click(await screen.findByRole('button', { name: /选择目录并安装/ }));
    expect(await screen.findByRole('region', { name: '安装确认' })).toHaveTextContent('D:\\Tools');
    fireEvent.click(screen.getByRole('button', { name: '确认下载并安装' }));
    await waitFor(() => expect(getSoftwareInstallJob).toHaveBeenCalledWith('job-1'), { timeout: 2000 });
    expect(await screen.findByText(/安装完成：D:\\Tools/)).toBeVisible();
    expect(scanDevelopmentSoftware).toHaveBeenCalledTimes(2);
  });

  it('retains the verified Agent error when an installation fails', async () => {
    vi.mocked(listEngineeringProjects).mockResolvedValue([ninjaProject]);
    vi.mocked(getAgentStatus).mockResolvedValue({ available: true, name: 'Agent', version: '1', protocolVersion: 1, uptimeSeconds: 1, capabilities: ['software-environment', 'software-installation'], serialSessions: 0, networkSessions: 0, buildJobs: 0 });
    vi.mocked(scanDevelopmentSoftware).mockResolvedValue({ schemaVersion: 1, platform: 'win32', architecture: 'x64', detectedAt: '', unavailable: [], installations: [] });
    vi.mocked(listSoftwareInstallManifests).mockResolvedValue([manifest]);
    vi.mocked(selectLocalDirectory).mockResolvedValue({ cancelled: false, kind: 'directory', path: 'D:\\Tools', selectionId: 'selection-1' });
    vi.mocked(createSoftwareInstallJob).mockResolvedValue(runningJob);
    vi.mocked(getSoftwareInstallJob).mockResolvedValue({ ...runningJob, state: 'failed', progress: 75, finishedAt: 'now', error: 'Downloaded package failed SHA-256 or size verification', events: [{ time: 'now', level: 'error', message: 'Downloaded package failed SHA-256 or size verification' }] });
    render(<DevelopmentEnvironmentPage />);
    fireEvent.click(await screen.findByRole('button', { name: /选择目录并安装/ }));
    fireEvent.click(await screen.findByRole('button', { name: '确认下载并安装' }));
    expect(await screen.findByText('Downloaded package failed SHA-256 or size verification')).toBeVisible();
    expect(scanDevelopmentSoftware).toHaveBeenCalledTimes(1);
  });

  it('shows an Agent upgrade boundary when installation is unsupported', async () => {
    vi.mocked(listEngineeringProjects).mockResolvedValue([ninjaProject]);
    vi.mocked(getAgentStatus).mockResolvedValue({ available: true, name: 'Agent', version: '1', protocolVersion: 1, uptimeSeconds: 1, capabilities: ['software-environment'], serialSessions: 0, networkSessions: 0, buildJobs: 0 });
    vi.mocked(scanDevelopmentSoftware).mockResolvedValue({ schemaVersion: 1, platform: 'win32', architecture: 'x64', detectedAt: '', unavailable: [], installations: [] });
    render(<DevelopmentEnvironmentPage />);
    expect(await screen.findByText(/可检测环境，但不支持受控安装/)).toBeVisible();
    expect(screen.queryByRole('button', { name: /选择目录并安装/ })).not.toBeInTheDocument();
  });
});
