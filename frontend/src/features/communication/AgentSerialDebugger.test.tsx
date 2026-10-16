import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AgentSerialDebugger from './AgentSerialDebugger';
import * as serialAgent from '../../services/serialAgent';

vi.mock('../../services/serialAgent', () => ({
  closeSerialSession: vi.fn(),
  listSerialPorts: vi.fn(),
  listSerialSessions: vi.fn(),
  openSerialSession: vi.fn(),
  readSerialSession: vi.fn(),
  sendSerialData: vi.fn(),
  setSerialSignals: vi.fn(),
  updateSerialBaudRate: vi.fn(),
}));

describe('AgentSerialDebugger independent degradation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    window.location.hash = '';
    vi.mocked(serialAgent.listSerialPorts).mockReset();
    vi.mocked(serialAgent.listSerialSessions).mockReset();
  });

  it('keeps the serial workspace usable when Local Agent is offline', async () => {
    vi.mocked(serialAgent.listSerialPorts).mockRejectedValue(new Error('Failed to fetch'));
    vi.mocked(serialAgent.listSerialSessions).mockRejectedValue(new Error('Failed to fetch'));

    render(<AgentSerialDebugger />);

    await waitFor(() =>
      expect(screen.getByText(/可切换“浏览器直连”/)).toBeVisible(),
    );
    expect(screen.getByRole('link', { name: '本地助手' })).toHaveAttribute('href', '#/agent');
    expect(screen.getByRole('button', { name: /连接/ })).toBeDisabled();
    expect(screen.getByPlaceholderText('搜索当前串口日志…')).toBeEnabled();
    expect(screen.getByTestId('agent-serial-terminal-left')).toBeVisible();
    expect(screen.getAllByText(/快捷指令/).length).toBeGreaterThan(0);
  });

  it('connects and sends through an independent serial session', async () => {
    const port = { path: 'VIRTUAL0', manufacturer: 'EmbedKit', serialNumber: 'EK-1', vendorId: '', productId: '', pnpId: '', friendlyName: 'Virtual Loopback' };
    const session = { id: 'session-1', path: 'VIRTUAL0', baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', dtr: false, rts: false, state: 'connected' as const, rxBytes: 0, txBytes: 0, openedAt: new Date().toISOString(), events: [] };
    vi.mocked(serialAgent.listSerialPorts).mockResolvedValue([port]);
    vi.mocked(serialAgent.listSerialSessions).mockResolvedValue([]);
    vi.mocked(serialAgent.openSerialSession).mockResolvedValue(session);
    vi.mocked(serialAgent.readSerialSession).mockResolvedValue(session);
    vi.mocked(serialAgent.sendSerialData).mockResolvedValue({ sent: 5 });

    render(<AgentSerialDebugger />);
    await waitFor(() => expect(screen.getByText('Agent：在线 · 0 个会话')).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: '连接' }));
    await waitFor(() => expect(screen.getByText('VIRTUAL0 · 115200 8N1')).toBeVisible());

    fireEvent.change(screen.getByLabelText('发送行尾'), { target: { value: 'crlf' } });
    const input = screen.getByPlaceholderText('输入内容，Enter 发送');
    fireEvent.change(input, { target: { value: 'AT' } });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    await waitFor(() => expect(serialAgent.sendSerialData).toHaveBeenCalledWith('session-1', 'AT\r\n', 'text'));

    fireEvent.click(screen.getByRole('button', { name: '用于集成测试' }));
    expect(JSON.parse(sessionStorage.getItem('embedkit.test-session-handoff.pending') || '{}')).toMatchObject({ version: 1, transport: 'serial', sessionId: 'session-1', path: 'VIRTUAL0', baudRate: 115200 });
    expect(window.location.hash).toBe('#/tests?handoff=serial');
    expect(serialAgent.closeSerialSession).not.toHaveBeenCalledWith('session-1');
  });

  it('hands real RX bytes to the protocol workspace with source context', async () => {
    const session = { id: 'session-rx', path: 'COM7', baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', dtr: false, rts: false, state: 'connected' as const, rxBytes: 4, txBytes: 0, openedAt: '2026-10-15T00:00:00Z', events: [{ id: 1, timestamp: '2026-10-15T00:00:01Z', direction: 'rx' as const, text: '', hex: 'AA 55 01 00', byteLength: 4 }] };
    vi.mocked(serialAgent.listSerialPorts).mockResolvedValue([]);
    vi.mocked(serialAgent.listSerialSessions).mockResolvedValue([session]);
    vi.mocked(serialAgent.readSerialSession).mockImplementation(() => new Promise(() => undefined));
    render(<AgentSerialDebugger />);

    const analyze = await screen.findByRole('button', { name: '用协议工作台解析 RX' });
    await waitFor(() => expect(analyze).toBeEnabled());
    fireEvent.click(analyze);
    const stored = JSON.parse(sessionStorage.getItem('embedkit.communication-capture.pending') || '{}');
    expect(stored).toMatchObject({ transport: 'serial', sessionId: 'session-rx', endpoint: 'COM7 · 115200 8N1', byteLength: 4 });
  });
});
