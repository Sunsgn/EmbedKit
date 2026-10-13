import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocketDebugger from './WebSocketDebugger';

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  binaryType: BinaryType = 'blob';
  readyState = FakeWebSocket.CONNECTING;
  sent: Array<string | ArrayBufferLike | Blob | ArrayBufferView> = [];
  close = vi.fn(() => {
    this.readyState = FakeWebSocket.CLOSED;
  });
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    this.sent.push(data);
  }
  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }
  receive(data: string | ArrayBuffer) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }
}

describe('WebSocketDebugger independent transport', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('rejects an invalid endpoint without creating a socket', () => {
    render(<WebSocketDebugger />);
    fireEvent.change(screen.getByLabelText('服务器地址'), {
      target: { value: 'http://localhost:8080' },
    });
    fireEvent.click(screen.getByRole('button', { name: '连接' }));

    expect(screen.getByText('地址必须以 ws:// 或 wss:// 开头')).toBeVisible();
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('connects and exchanges text frames without external project state', () => {
    const view = render(<WebSocketDebugger />);
    fireEvent.click(screen.getByRole('button', { name: '连接' }));
    const socket = FakeWebSocket.instances[0];

    act(() => socket.open());
    expect(screen.getByText('● 已连接')).toBeVisible();

    fireEvent.change(screen.getByPlaceholderText('输入文本，Enter 发送'), {
      target: { value: 'hello' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    expect(socket.sent).toEqual(['hello']);
    expect(screen.getByText('TX 1 帧 / 5 B')).toBeVisible();

    act(() => socket.receive('world'));
    expect(screen.getByText('world')).toBeVisible();
    expect(screen.getByText('RX 1 帧 / 5 B')).toBeVisible();

    view.unmount();
    expect(socket.close).toHaveBeenCalledOnce();
  });

  it('sends and displays binary frames as normalized HEX', () => {
    render(<WebSocketDebugger />);
    fireEvent.click(screen.getByRole('button', { name: '连接' }));
    const socket = FakeWebSocket.instances[0];
    act(() => socket.open());

    fireEvent.click(screen.getByLabelText('发送 HEX'));
    fireEvent.change(screen.getByPlaceholderText('HEX：DE AD BE EF'), {
      target: { value: 'de ad be ef' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    expect(socket.sent[0]).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(socket.sent[0] as ArrayBuffer))).toEqual([0xde, 0xad, 0xbe, 0xef]);
    act(() => socket.receive(Uint8Array.from([1, 2, 255]).buffer));
    expect(screen.getByText('01 02 FF')).toBeVisible();
  });

  it('keeps receiving and counting while terminal display is paused', () => {
    render(<WebSocketDebugger />);
    fireEvent.click(screen.getByRole('button', { name: '连接' }));
    const socket = FakeWebSocket.instances[0];
    act(() => socket.open());

    fireEvent.click(screen.getByLabelText('暂停显示'));
    act(() => socket.receive('hidden while paused'));
    expect(screen.queryByText('hidden while paused')).not.toBeInTheDocument();
    expect(screen.getByText('RX 1 帧 / 19 B')).toBeVisible();
    expect(screen.getByText('显示已暂停，仍在接收')).toBeVisible();

    fireEvent.click(screen.getByLabelText('暂停显示'));
    expect(screen.getByText('hidden while paused')).toBeVisible();
  });
});
