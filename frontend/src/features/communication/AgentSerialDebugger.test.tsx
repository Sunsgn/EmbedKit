import { render, screen, waitFor } from '@testing-library/react';
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
    vi.mocked(serialAgent.listSerialPorts).mockReset();
    vi.mocked(serialAgent.listSerialSessions).mockReset();
  });

  it('keeps the serial workspace usable when Local Agent is offline', async () => {
    vi.mocked(serialAgent.listSerialPorts).mockRejectedValue(new Error('Failed to fetch'));
    vi.mocked(serialAgent.listSerialSessions).mockRejectedValue(new Error('Failed to fetch'));

    render(<AgentSerialDebugger />);

    await waitFor(() => expect(screen.getByText('Agent：未连接')).toBeVisible());
    expect(screen.getByText(/请重启 proxy 目录中的 Local Agent/)).toBeVisible();
    expect(screen.getByRole('button', { name: /连接/ })).toBeDisabled();
    expect(screen.getByPlaceholderText('搜索当前串口日志…')).toBeEnabled();
    expect(screen.getAllByText(/快捷指令/).length).toBeGreaterThan(0);
  });
});
