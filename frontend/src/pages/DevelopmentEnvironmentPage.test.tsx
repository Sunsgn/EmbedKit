import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DevelopmentEnvironmentPage from './DevelopmentEnvironmentPage';
import { AgentClientError, getAgentStatus } from '../services/agentClient';
import { scanDevelopmentSoftware } from '../services/developmentEnvironment';
import { listDeviceProjects } from '../services/productStorage';

vi.mock('../services/agentClient', async importOriginal => {
  const original = await importOriginal<typeof import('../services/agentClient')>();
  return { ...original, getAgentStatus: vi.fn() };
});
vi.mock('../services/developmentEnvironment', async importOriginal => {
  const original = await importOriginal<typeof import('../services/developmentEnvironment')>();
  return { ...original, scanDevelopmentSoftware: vi.fn() };
});
vi.mock('../services/productStorage', () => ({ listDeviceProjects: vi.fn() }));

const project = {
  schemaVersion: 2 as const, id: 'p1', name: '控制器', productModel: '', chipModel: '', description: '', tags: [], features: [], resourceLinks: [], devices: [], createdAt: '', updatedAt: '2026-10-14T00:00:00.000Z',
  environmentRequirements: [{ id: 'r1', capabilityId: 'build.cmake', displayName: 'CMake', versionRange: '>=3.28', optional: false, source: 'user' as const, evidence: 'CMakeLists.txt' }],
};

describe('DevelopmentEnvironmentPage', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(listDeviceProjects).mockResolvedValue([project]); });

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
});
