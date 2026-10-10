import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectBuildPanel from './ProjectBuildPanel';
import * as agentClient from '../../services/agentClient';
import * as buildAgent from '../../services/buildAgent';
import * as localFiles from '../../services/localFiles';

vi.mock('../../services/agentClient', () => ({ getAgentStatus: vi.fn(), hasAgentCapability: vi.fn() }));
vi.mock('../../services/buildAgent', () => ({ authorizeBuildArtifact: vi.fn(), createBuildJob: vi.fn(), detectBuildEnvironment: vi.fn(), readBuildJob: vi.fn(), stopBuildJob: vi.fn() }));
vi.mock('../../services/localFiles', () => ({ selectLocalDirectory: vi.fn() }));

const status = { available: true, name: 'EmbedKit Local Agent', version: '1.0.0', protocolVersion: 1, uptimeSeconds: 1, capabilities: ['project-build'], serialSessions: 0, networkSessions: 0, buildJobs: 0 };
const props = { onClose: vi.fn(), onDiagnostic: vi.fn() };

describe('ProjectBuildPanel capability-gated workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(agentClient.getAgentStatus).mockResolvedValue(status);
    vi.mocked(agentClient.hasAgentCapability).mockReturnValue(true);
  });

  it('degrades without blocking existing project analysis when build capability is unavailable', async () => {
    vi.mocked(agentClient.getAgentStatus).mockRejectedValue(new Error('无法连接本地助手'));

    render(<ProjectBuildPanel {...props} />);

    await waitFor(() => expect(screen.getByText(/源码、MAP、ELF 和固件分析不受影响/)).toBeVisible());
    expect(screen.getByRole('button', { name: '构建' })).toBeDisabled();
    expect(screen.getByPlaceholderText(/my_project/)).toBeEnabled();
  });

  it('detects a CMake project and starts a real build job through the service', async () => {
    vi.mocked(buildAgent.detectBuildEnvironment).mockResolvedValue({ rootPath: 'D:\\firmware\\demo', system: 'cmake', buildDir: 'out', projectFiles: ['CMakeLists.txt'], tools: [{ executable: 'cmake', available: true, version: '4.0' }] });
    vi.mocked(buildAgent.createBuildJob).mockResolvedValue({ id: 'build-1', state: 'passed', exitCode: 0, startedAt: '', finishedAt: '', events: [] });

    render(<ProjectBuildPanel {...props} />);
    await waitFor(() => expect(screen.queryByText(/正在检测本地助手/)).not.toBeInTheDocument());
    const root = screen.getByPlaceholderText(/my_project/);
    fireEvent.change(root, { target: { value: 'D:\\firmware\\demo' } });
    fireEvent.click(screen.getByRole('button', { name: '检测' }));
    await waitFor(() => expect(buildAgent.detectBuildEnvironment).toHaveBeenCalledWith('D:\\firmware\\demo'));
    expect(await screen.findByText(/CMakeLists.txt/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '构建' }));
    await waitFor(() => expect(buildAgent.createBuildJob).toHaveBeenCalledWith(expect.objectContaining({ rootPath: 'D:\\firmware\\demo', system: 'cmake', buildDir: 'out', toolPath: 'cmake', action: 'build' })));
  });

  it('uses the system directory picker and immediately detects the selected project', async () => {
    vi.mocked(localFiles.selectLocalDirectory).mockResolvedValue({ cancelled: false, kind: 'directory', path: 'D:\\firmware\\picked', name: 'picked' });
    vi.mocked(buildAgent.detectBuildEnvironment).mockResolvedValue({ rootPath: 'D:\\firmware\\picked', system: 'ninja', buildDir: '.', projectFiles: ['build.ninja'], tools: [{ executable: 'ninja', available: true, version: '1.12' }] });

    render(<ProjectBuildPanel {...props} />);
    await waitFor(() => expect(screen.getByRole('button', { name: '选择目录' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '选择目录' }));

    await waitFor(() => expect(buildAgent.detectBuildEnvironment).toHaveBeenCalledWith('D:\\firmware\\picked'));
    expect(screen.getByDisplayValue('D:\\firmware\\picked')).toBeVisible();
    expect(await screen.findByText(/build\.ninja/)).toBeVisible();
  });

  it('authorizes a discovered ELF artifact before handing it to analysis', async () => {
    const onArtifactAnalyze = vi.fn(), artifact = { name: 'app.axf', path: 'D:\\firmware\\demo\\build\\app.axf', type: 'axf', size: 4096, modifiedAt: '2026-10-10T00:00:00.000Z' };
    vi.mocked(buildAgent.createBuildJob).mockResolvedValue({ id: 'build-elf', state: 'passed', exitCode: 0, startedAt: '', finishedAt: '', artifacts: [artifact], events: [] });
    vi.mocked(buildAgent.authorizeBuildArtifact).mockResolvedValue({ cancelled: false, kind: 'file', name: 'app.axf', selectionId: 'selection-elf' });
    render(<ProjectBuildPanel {...props} onArtifactAnalyze={onArtifactAnalyze} />);
    fireEvent.change(screen.getByPlaceholderText(/my_project/), { target: { value: 'D:\\firmware\\demo' } });
    await waitFor(() => expect(screen.getByRole('button', { name: '构建' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '构建' }));
    const analyze = await screen.findByRole('button', { name: 'ELF 分析' }); fireEvent.click(analyze);
    await waitFor(() => expect(buildAgent.authorizeBuildArtifact).toHaveBeenCalledWith('build-elf', 0));
    expect(onArtifactAnalyze).toHaveBeenCalledWith(artifact, 'selection-elf');
  });

  it('offers the same controlled authorization for a discovered MAP artifact', async () => {
    const onArtifactAnalyze = vi.fn(), artifact = { name: 'app.map', path: 'D:\\firmware\\demo\\build\\app.map', type: 'map', size: 2048, modifiedAt: '2026-10-10T00:00:00.000Z' };
    vi.mocked(buildAgent.createBuildJob).mockResolvedValue({ id: 'build-map', state: 'passed', exitCode: 0, startedAt: '', finishedAt: '', artifacts: [artifact], events: [] });
    vi.mocked(buildAgent.authorizeBuildArtifact).mockResolvedValue({ cancelled: false, kind: 'file', name: 'app.map', selectionId: 'selection-map' });
    render(<ProjectBuildPanel {...props} onArtifactAnalyze={onArtifactAnalyze} />);
    fireEvent.change(screen.getByPlaceholderText(/my_project/), { target: { value: 'D:\\firmware\\demo' } });
    await waitFor(() => expect(screen.getByRole('button', { name: '构建' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '构建' }));
    fireEvent.click(await screen.findByRole('button', { name: 'MAP 分析' }));
    await waitFor(() => expect(buildAgent.authorizeBuildArtifact).toHaveBeenCalledWith('build-map', 0));
    expect(onArtifactAnalyze).toHaveBeenCalledWith(artifact, 'selection-map');
  });

  it.each([['bin', 'BIN 工具'], ['hex', 'HEX 工具']])('authorizes a discovered %s artifact before opening its tool', async (type, label) => {
    const onArtifactAnalyze = vi.fn(), artifact = { name: `app.${type}`, path: `D:\\firmware\\demo\\build\\app.${type}`, type, size: 128, modifiedAt: '2026-10-10T00:00:00.000Z' };
    vi.mocked(buildAgent.createBuildJob).mockResolvedValue({ id: `build-${type}`, state: 'passed', exitCode: 0, startedAt: '', finishedAt: '', artifacts: [artifact], events: [] });
    vi.mocked(buildAgent.authorizeBuildArtifact).mockResolvedValue({ cancelled: false, kind: 'file', name: artifact.name, selectionId: `selection-${type}` });
    render(<ProjectBuildPanel {...props} onArtifactAnalyze={onArtifactAnalyze} />);
    fireEvent.change(screen.getByPlaceholderText(/my_project/), { target: { value: 'D:\\firmware\\demo' } });
    await waitFor(() => expect(screen.getByRole('button', { name: '构建' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '构建' })); fireEvent.click(await screen.findByRole('button', { name: label }));
    await waitFor(() => expect(buildAgent.authorizeBuildArtifact).toHaveBeenCalledWith(`build-${type}`, 0));
    expect(onArtifactAnalyze).toHaveBeenCalledWith(artifact, `selection-${type}`);
  });
});
