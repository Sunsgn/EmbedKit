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

  it('starts receiving even when the adapter rejects DTR and RTS signals', async () => {
    const readable = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('device ready\r\n')); },
    });
    const port = {
      readable,
      writable: new WritableStream<Uint8Array>(),
      open: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      getInfo: () => ({ usbVendorId: 0x1234, usbProductId: 0x5678 }),
      setSignals: vi.fn().mockRejectedValue(new Error('signals unsupported')),
    };
    Object.defineProperty(navigator, 'serial', { configurable: true, value: { requestPort: vi.fn().mockResolvedValue(port), addEventListener: vi.fn(), removeEventListener: vi.fn() } });

    const view = render(<SerialPage />);
    fireEvent.click(screen.getByRole('button', { name: /添加/ }));

    expect(await screen.findByText('device ready')).toBeVisible();
    expect(screen.getByText(/控制信号未应用，串口接收继续运行/)).toBeVisible();
    expect(screen.getByText('RX 14 B')).toBeVisible();
    expect(screen.getByTestId('browser-serial-terminal-left')).toBeVisible();
    view.unmount();
  });
});
