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
    vi.mocked(serialAgent.listSerialPorts).mockReset();
    vi.mocked(serialAgent.listSerialSessions).mockReset();
  });

  it('keeps the serial workspace usable when Local Agent is offline', async () => {
    vi.mocked(serialAgent.listSerialPorts).mockRejectedValue(new Error('Failed to fetch'));
    vi.mocked(serialAgent.listSerialSessions).mockRejectedValue(new Error('Failed to fetch'));

    render(<AgentSerialDebugger />);

    await waitFor(() =>
      expect(screen.getByText(/请重启 proxy 目录中的 Local Agent/)).toBeVisible(),
    );
    expect(screen.getByRole('button', { name: /连接/ })).toBeDisabled();
    expect(screen.getByPlaceholderText('搜索当前串口日志…')).toBeEnabled();
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
  });
});
