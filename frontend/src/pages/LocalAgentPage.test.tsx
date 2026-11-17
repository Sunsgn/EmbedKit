import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LocalAgentPage from './LocalAgentPage';
import { AgentClientError, getAgentStatus } from '../services/agentClient';

vi.mock('../services/agentClient', async importOriginal => ({ ...(await importOriginal<typeof import('../services/agentClient')>()), getAgentStatus: vi.fn() }));

describe('LocalAgentPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows verified capabilities and active session counts', async () => {
    vi.mocked(getAgentStatus).mockResolvedValue({ available: true, name: 'EmbedKit Local Agent', version: '1.0.0', protocolVersion: 1, uptimeSeconds: 5, capabilities: ['serial', 'elf-analysis'], serialSessions: 1, networkSessions: 2, buildJobs: 0 });
    render(<LocalAgentPage />);
    expect(await screen.findByText(/已连接 EmbedKit Local Agent/)).toBeVisible();
    expect(screen.getByText('真实串口')).toBeVisible();
    expect(screen.getByText('ELF / DWARF')).toBeVisible();
    expect(screen.getByText('2', { selector: 'b' })).toBeVisible();
  });

  it('keeps browser fallback visible and can retry an offline Agent', async () => {
    vi.mocked(getAgentStatus).mockRejectedValueOnce(new AgentClientError('offline', '无法连接本地助手')).mockResolvedValueOnce({ available: true, name: 'EmbedKit Local Agent', version: '1.0.0', protocolVersion: 1, uptimeSeconds: 1, capabilities: [], serialSessions: 0, networkSessions: 0, buildJobs: 0 });
    render(<LocalAgentPage />);
    expect(await screen.findByText('本地助手未连接')).toBeVisible();
    expect(screen.getByText(/网页工具可独立使用/)).toBeVisible();
    expect(screen.getByRole('heading', { name: '下载 Local Agent 便携版' })).toBeVisible();
    expect(screen.getByText(/不是 EXE\/MSI 安装器/)).toBeVisible();
    expect(screen.getByRole('link', { name: '查看版本、文件大小和发布说明' })).toHaveAttribute('href', 'https://github.com/sunsgn/EmbedKit/releases/latest');
    expect(screen.getAllByRole('link', { name: '下载' })).toHaveLength(4);
    expect(screen.getAllByRole('link', { name: 'SHA-256' })).toHaveLength(4);
    expect(screen.getByText('Windows x64').parentElement?.querySelector('a[href$="embedkit-local-agent-windows-x64.zip"]')).not.toBeNull();
    expect(screen.getByText('Windows x64').parentElement?.querySelector('a[href$="embedkit-local-agent-windows-x64.sha256"]')).not.toBeNull();
    expect(screen.getByText(/若下载显示 404/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '重新检测' }));
    expect(await screen.findByText(/已连接 EmbedKit Local Agent/)).toBeVisible();
    await waitFor(() => expect(getAgentStatus).toHaveBeenCalledTimes(2));
  });
});
