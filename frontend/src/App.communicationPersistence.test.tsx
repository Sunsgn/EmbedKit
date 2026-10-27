import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./pages/DashboardPage', () => ({ default: () => <div>测试工作台首页</div> }));
vi.mock('./pages/CommunicationPage', () => ({ default: () => <label>通信现场<input aria-label="通信现场状态" /></label> }));

describe('application communication workspace lifetime', () => {
  beforeEach(() => {
    window.location.hash = '#/';
    sessionStorage.clear();
  });

  it('keeps the communication workspace mounted across application routes', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '通信调试' }));
    const state = await screen.findByLabelText('通信现场状态');
    fireEvent.change(state, { target: { value: '串口连接与日志仍在' } });

    fireEvent.click(screen.getByRole('button', { name: '工作台' }));
    await screen.findByText('测试工作台首页');
    expect(state).not.toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '通信调试' }));
    await waitFor(() => expect(state).toBeVisible());
    expect(state).toHaveValue('串口连接与日志仍在');
  });
});
