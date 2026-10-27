import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SerialPage from './SerialPage';

describe('SerialPage browser-direct mode', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serial');
    localStorage.clear();
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
    sessionStorage.clear();
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
    fireEvent.click(screen.getByRole('button', { name: '用协议工作台解析 RX' }));
    const stored = JSON.parse(sessionStorage.getItem('embedkit.communication-capture.pending') || '{}');
    expect(stored).toMatchObject({ transport: 'serial', byteLength: 14 });
    expect(stored.records[0].hex).toBe('64 65 76 69 63 65 20 72 65 61 64 79 0D 0A');
    view.unmount();
  });

  it('continuously appends every received chunk without waiting for an idle gap', async () => {
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('first line\r\n'));
        controller.enqueue(new TextEncoder().encode('second line'));
      },
    });
    const port = { readable, writable: new WritableStream<Uint8Array>(), open: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined), getInfo: () => ({}), setSignals: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(navigator, 'serial', { configurable: true, value: { requestPort: vi.fn().mockResolvedValue(port), addEventListener: vi.fn(), removeEventListener: vi.fn() } });

    const view = render(<SerialPage />);
    fireEvent.click(screen.getByRole('button', { name: /添加/ }));
    const terminal = await screen.findByTestId('browser-serial-terminal-left');
    await waitFor(() => expect(terminal.textContent).toContain('first line\r\nsecond line'));
    expect(within(terminal).getAllByText('RX')).toHaveLength(1);
    expect(screen.getByText('RX 23 B')).toBeVisible();
    expect(JSON.parse(localStorage.getItem('embedkit.serial.settings') || '{}')).toMatchObject({ version: 3, frameMode: 'raw' });
    view.unmount();
  });

  it('keeps HEX display independent for the left and right split panes', async () => {
    const createPort = (text: string) => ({
      readable: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(`${text}\n`)); } }),
      writable: new WritableStream<Uint8Array>(),
      open: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      getInfo: () => ({}),
      setSignals: vi.fn().mockResolvedValue(undefined),
    });
    const requestPort = vi.fn().mockResolvedValueOnce(createPort('left')).mockResolvedValueOnce(createPort('right'));
    Object.defineProperty(navigator, 'serial', { configurable: true, value: { requestPort, addEventListener: vi.fn(), removeEventListener: vi.fn() } });

    const view = render(<SerialPage />);
    fireEvent.click(screen.getByRole('button', { name: /添加/ }));
    expect(await screen.findByText('left')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /添加/ }));
    expect(await screen.findByText('right')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '双窗口' }));

    const leftTerminal = screen.getByTestId('browser-serial-terminal-left');
    const rightTerminal = screen.getByTestId('browser-serial-terminal-right');
    const leftHex = screen.getByRole('checkbox', { name: '左侧窗口 HEX' });
    const rightHex = screen.getByRole('checkbox', { name: '右侧窗口 HEX' });
    expect(leftHex).not.toBeChecked();
    expect(rightHex).not.toBeChecked();

    fireEvent.click(leftHex);
    expect(within(leftTerminal).getByText('72 69 67 68 74 0A')).toBeVisible();
    expect(within(rightTerminal).getByText('left')).toBeVisible();
    expect(rightHex).not.toBeChecked();
    expect(JSON.parse(localStorage.getItem('embedkit.serial.settings') || '{}')).toMatchObject({ version: 3, leftRxHex: true, rightRxHex: false });
    view.unmount();
  });
});
