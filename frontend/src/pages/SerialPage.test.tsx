import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SerialPage from './SerialPage';

describe('SerialPage browser-direct mode', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serial');
    vi.restoreAllMocks();
  });

  it('explains the browser requirement when Web Serial is unavailable', () => {
    Reflect.deleteProperty(navigator, 'serial');
    render(<SerialPage />);
    expect(screen.getByText('当前浏览器不支持 Web Serial')).toBeVisible();
    expect(screen.getByText(/Chrome \/ Edge/)).toBeVisible();
  });

  it('opens the system serial chooser without requiring Local Agent', async () => {
    const requestPort = vi.fn().mockRejectedValue(new Error('cancel'));
    Object.defineProperty(navigator, 'serial', { configurable: true, value: { requestPort, addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    render(<SerialPage />);
    fireEvent.click(screen.getByRole('button', { name: /添加/ }));
    await waitFor(() => expect(requestPort).toHaveBeenCalledOnce());
    expect(screen.queryByText(/Local Agent/)).not.toBeInTheDocument();
  });
});
