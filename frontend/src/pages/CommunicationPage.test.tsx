import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CommunicationPage from './CommunicationPage';

vi.mock('../features/communication/AgentSerialDebugger', () => ({ default: () => <div>独立串口工作区</div> }));
vi.mock('./SerialPage', () => ({ default: () => <div>浏览器直连串口工作区</div> }));
vi.mock('../features/communication/WebSocketDebugger', () => ({ default: () => <div>独立 WebSocket 工作区</div> }));
vi.mock('../features/communication/AgentNetworkDebugger', () => ({ default: () => <div>独立 TCP UDP 工作区</div> }));

describe('CommunicationPage independent mode', () => {
  beforeEach(() => sessionStorage.clear());

  it('opens serial debugging without a device project or test suite', () => {
    render(<CommunicationPage />);

    expect(screen.getByRole('tab', { name: /串口调试/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('浏览器直连串口工作区')).toBeVisible();
    expect(screen.queryByText(/请选择设备项目/)).not.toBeInTheDocument();
  });

  it('uses browser serial by default and keeps Local Agent as an optional enhancement', () => {
    render(<CommunicationPage />);

    expect(screen.getByRole('group', { name: '串口连接方式' })).toBeVisible();
    expect(screen.getByLabelText('串口连接说明')).toHaveAttribute('title', 'Chrome / Edge 可直接选择串口；后台会话与非 Web Serial 环境使用本地助手');
    fireEvent.click(screen.getByRole('button', { name: '本地助手增强' }));
    expect(screen.getByText('独立串口工作区')).toBeVisible();
    expect(sessionStorage.getItem('embedkit.communication.serial-backend')).toBe('agent');
  });

  it('switches independently between all communication transports', () => {
    render(<CommunicationPage />);

    fireEvent.click(screen.getByRole('tab', { name: /WebSocket/ }));
    expect(screen.getByText('独立 WebSocket 工作区')).toBeVisible();

    fireEvent.click(screen.getByRole('tab', { name: /TCP \/ UDP/ }));
    expect(screen.getByText('独立 TCP UDP 工作区')).toBeVisible();
    expect(sessionStorage.getItem('embedkit.communication.tab')).toBe('agent');
  });

  it('restores the last selected transport without external module state', () => {
    sessionStorage.setItem('embedkit.communication.tab', 'websocket');
    render(<CommunicationPage />);

    expect(screen.getByRole('tab', { name: /WebSocket/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('独立 WebSocket 工作区')).toBeVisible();
  });
});
