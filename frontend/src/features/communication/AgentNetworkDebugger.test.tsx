import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  events: [
    {
      id: 1,
      timestamp: '2026-10-10T08:48:07.314Z',
      direction: 'rx' as const,
      text: 'PONG',
      hex: '50 4F 4E 47',
      byteLength: 4,
    },
  ],
};

describe('AgentNetworkDebugger independent workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    vi.mocked(networkAgent.getNetworkStatus).mockResolvedValue({
      available: true,
      activeSessions: 0,
      maxSessions: 16,
    });
    vi.mocked(networkAgent.listNetworkSessions).mockResolvedValue([]);
    vi.mocked(networkAgent.readNetworkSession).mockImplementation(() => new Promise(() => undefined));
    vi.mocked(networkAgent.closeNetworkSession).mockResolvedValue({
      closed: true,
    });
    vi.mocked(networkAgent.sendNetworkData).mockResolvedValue({ sent: 4 });
  });

  it('keeps the network workspace available when Local Agent is offline', async () => {
    vi.mocked(networkAgent.getNetworkStatus).mockRejectedValue(new Error('无法连接本地助手'));
    vi.mocked(networkAgent.listNetworkSessions).mockRejectedValue(new Error('无法连接本地助手'));

    render(<AgentNetworkDebugger />);

    await waitFor(() => expect(screen.getByText(/TCP\/UDP 原始套接字需要/)).toBeVisible());
    expect(screen.getByText('Local Agent：未运行')).toBeVisible();
    expect(screen.getByRole('link', { name: '安装或查看本地助手' })).toHaveAttribute('href', '#/agent');
    expect(screen.getByRole('button', { name: '重新检测' })).toBeEnabled();
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

  it('applies selected line endings to TCP and UDP text sends', async () => {
    vi.mocked(networkAgent.listNetworkSessions).mockResolvedValue([connectedSession]);
    render(<AgentNetworkDebugger />);
    await screen.findByText('PONG');
    fireEvent.change(screen.getByLabelText('发送行尾'), { target: { value: 'crlf' } });
    fireEvent.change(screen.getByPlaceholderText('输入文本，Enter 发送'), { target: { value: 'PING' } });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    await waitFor(() => expect(networkAgent.sendNetworkData).toHaveBeenCalledWith('network-1', 'PING\r\n', 'text'));
  });

  it('hands RX bytes to the protocol workspace without requiring a project', async () => {
    vi.mocked(networkAgent.listNetworkSessions).mockResolvedValue([connectedSession]);
    render(<AgentNetworkDebugger />);

    const analyze = await screen.findByRole('button', { name: '用协议工作台解析 RX' });
    fireEvent.click(analyze);
    const stored = JSON.parse(sessionStorage.getItem('embedkit.communication-capture.pending') || '{}');
    expect(stored).toMatchObject({ transport: 'tcp', sessionId: 'network-1', byteLength: 4 });
    expect(stored.records[0].hex).toBe('50 4F 4E 47');
  });

  it('groups TCP display bursts but hands untouched events to the protocol workspace', async () => {
    const session = { ...connectedSession, rxBytes: 8, events: [
      { ...connectedSession.events[0], id: 1, timestamp: '2026-10-10T08:48:07.314Z' },
      { ...connectedSession.events[0], id: 2, timestamp: '2026-10-10T08:48:07.324Z', text: 'NEXT', hex: '4E 45 58 54' },
    ] };
    vi.mocked(networkAgent.listNetworkSessions).mockResolvedValue([session]);
    render(<AgentNetworkDebugger />);
    const terminal = await screen.findByTestId('network-terminal-left');
    await waitFor(() => expect(terminal.textContent).toContain('PONGNEXT'));
    expect(within(terminal).getAllByText('RX')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '用协议工作台解析 RX' }));
    const stored = JSON.parse(sessionStorage.getItem('embedkit.communication-capture.pending') || '{}');
    expect(stored.records).toHaveLength(2);
    expect(stored.records.map((item: { hex: string }) => item.hex)).toEqual(['50 4F 4E 47', '4E 45 58 54']);
  });

  it('keeps split-pane HEX and shortcut cycles isolated by network session', async () => {
    localStorage.setItem('embedkit.serial.shortcuts', JSON.stringify([{ id: 101, name: '轮询', value: 'PING', hex: false, intervalMs: 1000 }]));
    const second = { ...connectedSession, id: 'network-2', host: '127.0.0.2', events: [{ ...connectedSession.events[0], text: 'RIGHT', hex: '52 49 47 48 54', byteLength: 5 }] };
    vi.mocked(networkAgent.listNetworkSessions).mockResolvedValue([connectedSession, second]);
    render(<AgentNetworkDebugger />);
    const splitButton = await screen.findByRole('button', { name: '双窗口' });
    await waitFor(() => expect(splitButton).toBeEnabled());
    fireEvent.click(splitButton);
    const left = screen.getByTestId('network-terminal-left'), right = screen.getByTestId('network-terminal-right');
    fireEvent.click(screen.getByRole('checkbox', { name: '左侧网络窗口 HEX' }));
    expect(within(left).getByText('50 4F 4E 47')).toBeVisible();
    expect(within(right).getByText('RIGHT')).toBeVisible();
    fireEvent.click(screen.getByTitle('每 1000ms 周期发送'));
    expect(screen.getByTitle('停止周期发送')).toBeVisible();
    fireEvent.click(right);
    expect(screen.queryByTitle('停止周期发送')).not.toBeInTheDocument();
  });

  it('creates and closes an independent TCP Client session', async () => {
    vi.mocked(networkAgent.openNetworkSession).mockResolvedValue(connectedSession);

    render(<AgentNetworkDebugger />);
    await waitFor(() => expect(screen.getByText(/Local Agent：已连接/)).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: '添加连接' }));

    await waitFor(() =>
      expect(networkAgent.openNetworkSession).toHaveBeenCalledWith({
        type: 'tcp',
        mode: 'client',
        host: '127.0.0.1',
        port: 9000,
        localPort: 0,
      }),
    );
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
