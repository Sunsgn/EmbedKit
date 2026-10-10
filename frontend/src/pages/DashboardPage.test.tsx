import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './DashboardPage';
import { AgentClientError, getAgentStatus } from '../services/agentClient';
import { listDeviceProjects, listTestRuns } from '../services/productStorage';

vi.mock('../services/agentClient', async importOriginal => {
  const original = await importOriginal<typeof import('../services/agentClient')>();
  return { ...original, getAgentStatus: vi.fn() };
});
vi.mock('../services/productStorage', () => ({ listDeviceProjects: vi.fn(), listTestRuns: vi.fn() }));

describe('DashboardPage Local Agent status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listDeviceProjects).mockResolvedValue([]);
    vi.mocked(listTestRuns).mockResolvedValue([]);
  });

  it('shows centralized Agent capabilities when online', async () => {
    vi.mocked(getAgentStatus).mockResolvedValue({ available: true, name: 'EmbedKit Local Agent', version: '1.0.0', protocolVersion: 1, uptimeSeconds: 1, capabilities: ['serial', 'project-build'], serialSessions: 1, networkSessions: 2, buildJobs: 0 });
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/v1\.0\.0 · 2 项能力/)).toBeVisible());
    expect(screen.getByText('1 串口 · 2 网络会话')).toBeVisible();
  });

  it('distinguishes an incompatible Agent while leaving browser tools available', async () => {
    vi.mocked(getAgentStatus).mockRejectedValue(new AgentClientError('incompatible', '协议不兼容'));
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/协议不兼容，请更新本地助手/)).toBeVisible());
    expect(screen.getByText('Agent 需要更新')).toBeVisible();
    expect(screen.getByText('打开工程工具箱')).toBeVisible();
  });
});
