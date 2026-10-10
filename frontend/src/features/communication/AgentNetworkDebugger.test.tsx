import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AgentNetworkDebugger from './AgentNetworkDebugger';
import * as networkAgent from '../../services/networkAgent';

vi.mock('../../services/networkAgent', () => ({
  closeNetworkSession: vi.fn(),
  getNetworkStatus: vi.fn(),
  listNetworkSessions: vi.fn(),
  openNetworkSession: vi.fn(),
  readNetworkSession: vi.fn(),
  sendNetworkData: vi.fn(),
}));

const connectedSession = {
  id: 'network-1',
  type: 'tcp' as const,
  mode: 'client' as const,
  host: '127.0.0.1',
  port: 9000,
  localAddress: '127.0.0.1:52341',
  state: 'connected' as const,
  rxBytes: 4,
  txBytes: 0,
  events: [{ id: 1, timestamp: '2026-10-10T08:48:07.314Z', direction: 'rx' as const, text: 'PONG', hex: '50 4F 4E 47', byteLength: 4 }],
};

describe('AgentNetworkDebugger independent workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(networkAgent.getNetworkStatus).mockResolvedValue({ available: true, activeSessions: 0, maxSessions: 16 });
    vi.mocked(networkAgent.listNetworkSessions).mockResolvedValue([]);
    vi.mocked(networkAgent.readNetworkSession).mockImplementation(() => new Promise(() => undefined));
    vi.mocked(networkAgent.closeNetworkSession).mockResolvedValue({ closed: true });
    vi.mocked(networkAgent.sendNetworkData).mockResolvedValue({ sent: 4 });
  });

  it('keeps the network workspace available when Local Agent is offline', async () => {
    vi.mocked(networkAgent.getNetworkStatus).mockRejectedValue(new Error('无法连接本地助手'));
    vi.mocked(networkAgent.listNetworkSessions).mockRejectedValue(new Error('无法连接本地助手'));

    render(<AgentNetworkDebugger />);

    await waitFor(() => expect(screen.getByText('npm start')).toBeVisible());
    expect(screen.getByText('Local Agent：未运行')).toBeVisible();
    expect(screen.getByRole('button', { name: '添加连接' })).toBeDisabled();
    expect(screen.getByPlaceholderText('搜索当前会话日志…')).toBeEnabled();
    expect(screen.getByLabelText('协议角色')).toBeEnabled();
  });

  it('restores an existing session and sends data through the network service', async () => {
    vi.mocked(networkAgent.listNetworkSessions).mockResolvedValue([connectedSession]);

    render(<AgentNetworkDebugger />);

    await waitFor(() => expect(screen.getByText('PONG')).toBeVisible());
    const input = screen.getByPlaceholderText('输入文本，Enter 发送');
    fireEvent.change(input, { target: { value: 'PING' } });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => expect(networkAgent.sendNetworkData).toHaveBeenCalledWith('network-1', 'PING', 'text'));
  });

  it('creates and closes an independent TCP Client session', async () => {
    vi.mocked(networkAgent.openNetworkSession).mockResolvedValue(connectedSession);

    render(<AgentNetworkDebugger />);
    await waitFor(() => expect(screen.getByText(/Local Agent：已连接/)).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: '添加连接' }));

    await waitFor(() => expect(networkAgent.openNetworkSession).toHaveBeenCalledWith({ type: 'tcp', mode: 'client', host: '127.0.0.1', port: 9000, localPort: 0 }));
    fireEvent.click(screen.getByRole('button', { name: '停止' }));
    await waitFor(() => expect(networkAgent.closeNetworkSession).toHaveBeenCalledWith('network-1'));
  });

  it('shows structured service errors without losing the configured endpoint', async () => {
    vi.mocked(networkAgent.openNetworkSession).mockRejectedValue(new Error('目标拒绝连接 (NETWORK_CONNECT_FAILED)'));

    render(<AgentNetworkDebugger />);
    await waitFor(() => expect(screen.getByRole('button', { name: '添加连接' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '添加连接' }));

    await waitFor(() => expect(screen.getByText('目标拒绝连接 (NETWORK_CONNECT_FAILED)')).toBeVisible());
    expect(screen.getByDisplayValue('127.0.0.1')).toBeVisible();
    expect(screen.getByDisplayValue('9000')).toBeVisible();
  });
});
