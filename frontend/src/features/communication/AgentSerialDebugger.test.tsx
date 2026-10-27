import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    localStorage.clear();
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
    expect(serialAgent.openSerialSession).toHaveBeenCalledWith(expect.objectContaining({ path: 'VIRTUAL0', frameMode: 'raw', frameGapMs: 30 }));

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
    const session = { id: 'session-rx', path: 'COM7', baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', dtr: false, rts: false, frameMode: 'raw' as const, state: 'connected' as const, rxBytes: 4, txBytes: 0, openedAt: '2026-10-15T00:00:00Z', events: [{ id: 1, timestamp: '2026-10-15T00:00:01Z', direction: 'rx' as const, text: '', hex: 'AA 0D 0A 55', byteLength: 4 }] };
    vi.mocked(serialAgent.listSerialPorts).mockResolvedValue([]);
    vi.mocked(serialAgent.listSerialSessions).mockResolvedValue([session]);
    vi.mocked(serialAgent.readSerialSession).mockImplementation(() => new Promise(() => undefined));
    render(<AgentSerialDebugger />);

    const analyze = await screen.findByRole('button', { name: '用协议工作台解析 RX' });
    await waitFor(() => expect(analyze).toBeEnabled());
    fireEvent.click(analyze);
    const stored = JSON.parse(sessionStorage.getItem('embedkit.communication-capture.pending') || '{}');
    expect(stored).toMatchObject({ transport: 'serial', sessionId: 'session-rx', endpoint: 'COM7 · 115200 8N1', byteLength: 4 });
    expect(stored.records).toHaveLength(1);
    expect(stored.records[0].hex).toBe('AA 0D 0A 55');
  });

  it('keeps HEX display independent for the left and right split panes', async () => {
    const createSession = (id: string, path: string, text: string, hex: string) => ({
      id, path, baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', dtr: false, rts: false,
      state: 'connected' as const, rxBytes: text.length, txBytes: 0, openedAt: '2026-10-27T00:00:00Z',
      events: [{ id: 1, timestamp: '2026-10-27T00:00:01Z', direction: 'rx' as const, text, hex, byteLength: text.length }],
    });
    const leftSession = createSession('session-left', 'COM1', 'left', '6C 65 66 74');
    const rightSession = createSession('session-right', 'COM2', 'right', '72 69 67 68 74');
    vi.mocked(serialAgent.listSerialPorts).mockResolvedValue([]);
    vi.mocked(serialAgent.listSerialSessions).mockResolvedValue([leftSession, rightSession]);
    vi.mocked(serialAgent.readSerialSession).mockImplementation(() => new Promise(() => undefined));

    render(<AgentSerialDebugger />);
    const splitButton = await screen.findByRole('button', { name: '双窗口' });
    await waitFor(() => expect(splitButton).toBeEnabled());
    fireEvent.click(splitButton);

    const leftTerminal = screen.getByTestId('agent-serial-terminal-left');
    const rightTerminal = screen.getByTestId('agent-serial-terminal-right');
    const leftHex = screen.getByRole('checkbox', { name: '左侧窗口 HEX' });
    const rightHex = screen.getByRole('checkbox', { name: '右侧窗口 HEX' });
    expect(leftHex).not.toBeChecked();
    expect(rightHex).not.toBeChecked();

    fireEvent.click(leftHex);
    expect(within(leftTerminal).getByText('6C 65 66 74')).toBeVisible();
    expect(within(rightTerminal).getByText('right')).toBeVisible();
    expect(rightHex).not.toBeChecked();
    expect(JSON.parse(localStorage.getItem('embedkit.serial.settings') || '{}')).toMatchObject({ version: 3, leftRxHex: true, rightRxHex: false });
  });

  it('keeps shortcut cycle switches isolated between Local Agent split sessions', async () => {
    localStorage.setItem('embedkit.serial.shortcuts', JSON.stringify([{ id: 101, name: '轮询', value: 'AT', hex: false, intervalMs: 1000 }]));
    const createSession = (id: string, path: string) => ({
      id, path, baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', dtr: false, rts: false,
      state: 'connected' as const, rxBytes: 0, txBytes: 0, openedAt: '2026-10-27T00:00:00Z', events: [],
    });
    vi.mocked(serialAgent.listSerialPorts).mockResolvedValue([]);
    vi.mocked(serialAgent.listSerialSessions).mockResolvedValue([createSession('session-left', 'COM1'), createSession('session-right', 'COM2')]);
    vi.mocked(serialAgent.readSerialSession).mockImplementation(() => new Promise(() => undefined));

    render(<AgentSerialDebugger />);
    const splitButton = await screen.findByRole('button', { name: '双窗口' });
    await waitFor(() => expect(splitButton).toBeEnabled());
    fireEvent.click(splitButton);
    fireEvent.click(screen.getAllByTitle('每 1000ms 周期发送')[0]);
    expect(screen.getAllByTitle('停止周期发送').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('agent-serial-terminal-right'));
    expect(screen.queryByTitle('停止周期发送')).not.toBeInTheDocument();
    expect(screen.getAllByTitle('每 1000ms 周期发送').length).toBeGreaterThan(0);
  });

  it('keeps multiline Local Agent output in one receive burst without waiting', async () => {
    const session = {
      id: 'session-stream', path: 'COM8', baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', dtr: false, rts: false,
      frameMode: 'raw' as const, frameGapMs: 30, state: 'connected' as const, rxBytes: 28, txBytes: 0, openedAt: '2026-10-27T00:00:00Z',
      events: [
        { id: 1, timestamp: '2026-10-27T00:00:01Z', direction: 'rx' as const, text: 'first line\r\n', hex: '66 69 72 73 74 20 6C 69 6E 65 0D 0A', byteLength: 12 },
        { id: 2, timestamp: '2026-10-27T00:00:01.005Z', direction: 'tx' as const, text: 'poll', hex: '70 6F 6C 6C', byteLength: 4 },
        { id: 3, timestamp: '2026-10-27T00:00:01.010Z', direction: 'rx' as const, text: 'second line', hex: '73 65 63 6F 6E 64 20 6C 69 6E 65', byteLength: 11 },
        { id: 4, timestamp: '2026-10-27T00:00:02.010Z', direction: 'rx' as const, text: 'third', hex: '74 68 69 72 64', byteLength: 5 },
      ],
    };
    vi.mocked(serialAgent.listSerialPorts).mockResolvedValue([]);
    vi.mocked(serialAgent.listSerialSessions).mockResolvedValue([session]);
    vi.mocked(serialAgent.readSerialSession).mockImplementation(() => new Promise(() => undefined));

    render(<AgentSerialDebugger />);
    const terminal = await screen.findByTestId('agent-serial-terminal-left');
    await waitFor(() => expect(terminal.textContent).toContain('first line\r\nsecond line'));
    expect(terminal.textContent).toContain('poll');
    expect(terminal.textContent).toContain('third');
    expect(within(terminal).getAllByText('RX')).toHaveLength(2);
  });
});
