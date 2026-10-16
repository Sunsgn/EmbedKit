import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './DashboardPage';
import { AgentClientError, getAgentStatus } from '../services/agentClient';
import { listEngineeringProjects } from '../services/productStorage';

vi.mock('../services/agentClient', async importOriginal => {
  const original = await importOriginal<typeof import('../services/agentClient')>();
  return { ...original, getAgentStatus: vi.fn() };
});
vi.mock('../services/productStorage', () => ({ listEngineeringProjects: vi.fn() }));

describe('DashboardPage Local Agent status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listEngineeringProjects).mockResolvedValue([]);
  });

  it('shows centralized Agent capabilities when online', async () => {
    vi.mocked(getAgentStatus).mockResolvedValue({ available: true, name: 'EmbedKit Local Agent', version: '1.0.0', protocolVersion: 1, uptimeSeconds: 1, capabilities: ['serial', 'project-build'], serialSessions: 1, networkSessions: 2, buildJobs: 0 });
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/v1\.0\.0 · 2 项本机能力/)).toBeVisible());
    expect(screen.getByText('本地助手')).toBeVisible();
  });

  it('distinguishes an incompatible Agent while leaving browser tools available', async () => {
    vi.mocked(getAgentStatus).mockRejectedValue(new AgentClientError('incompatible', '协议不兼容'));
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/协议不兼容，请更新本地助手/)).toBeVisible());
    expect(screen.getByText('本地助手')).toBeVisible();
    expect(screen.getByText('嵌入式工具箱')).toBeVisible();
    expect(screen.getByText(/不要求先创建项目/)).toBeVisible();
  });

  it('presents the narrowed local toolbox workflow while retaining optional capabilities', () => {
    vi.mocked(getAgentStatus).mockRejectedValue(new Error('offline'));
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByText('工程与开发环境')).toBeVisible();
    expect(screen.getByText('资料与学习')).toBeVisible();
    expect(screen.getByText('通信与确定性工具')).toBeVisible();
    expect(screen.getByText('数据与 AI 协作')).toBeVisible();
    expect(screen.getByText('按需使用的扩展能力')).toBeVisible();
    expect(screen.getByText('工程分析')).toBeVisible();
    expect(screen.getByText(/AI 是可选消费者/)).toBeVisible();
  });
});
