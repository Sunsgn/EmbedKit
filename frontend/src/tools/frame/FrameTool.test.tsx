import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import FrameTool from './FrameTool';
import { createCommunicationCapture, writePendingCommunicationCapture } from '../../services/communicationCapture';

describe('FrameTool stream workflow', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  it('splits a noisy log and exposes incomplete trailing bytes', () => {
    render(<FrameTool />);
    fireEvent.click(screen.getByRole('button', { name: '连续日志拆包' }));
    fireEvent.change(screen.getByLabelText('连续字节流 HEX'), { target: { value: '00 FF AA 55 03 10 01 02 15 99 AA 55 02 11 03 15 AA 55 03 10' } });

    expect(screen.getByText('识别 2 帧')).toBeVisible();
    expect(screen.getByText('噪声 3 B')).toBeVisible();
    expect(screen.getByText('未完整尾部 4 B')).toBeVisible();
    expect(screen.getByRole('button', { name: '导出 CSV' })).toBeEnabled();
  });

  it('requires fixed payload length only for lengthless stream protocols', () => {
    render(<FrameTool />);
    fireEvent.click(screen.getByLabelText('包含单字节长度字段'));
    expect(screen.getByLabelText('固定负载长度')).toBeVisible();
    fireEvent.change(screen.getByLabelText('固定负载长度'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: '连续日志拆包' }));
    fireEvent.change(screen.getByLabelText('连续字节流 HEX'), { target: { value: 'AA 55 01 10 11 21 AA 55 02 20 21 42' } });
    expect(screen.getByText('识别 2 帧')).toBeVisible();
  });

  it('extracts evidence from pasted protocol text and requires confirmation before saving', () => {
    render(<FrameTool />);
    fireEvent.change(screen.getByLabelText('协议资料原文'), { target: { value: '# 温控协议\n帧头：5A A5\n命令码宽度：2 字节\n长度字段：1 字节\n校验：CRC16-Modbus' } });
    fireEvent.click(screen.getByRole('button', { name: '提取候选结构' }));

    expect(screen.getByDisplayValue('5A A5')).toBeVisible();
    expect(screen.getByText('第 2 行')).toBeVisible();
    const save = screen.getByRole('button', { name: '确认并保存协议模型' });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByText(/我已对照原始协议确认/));
    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(screen.getByText(/^已保存协议“/)).toBeVisible();
  });

  it('explains the unsupported binary-document boundary instead of pretending to parse PDF', () => {
    render(<FrameTool />);
    const file = new File(['%PDF'], 'protocol.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('导入协议资料'), { target: { files: [file] } });
    expect(screen.getByRole('alert')).toHaveTextContent(/不直接解析 PDF.*不会.*猜测/);
  });

  it('loads a versioned RX capture into continuous stream analysis', async () => {
    writePendingCommunicationCapture(createCommunicationCapture({ transport: 'tcp', sessionId: 'network-1', endpoint: 'TCP Client · 127.0.0.1:9000', events: [
      { timestamp: '2026-10-15T01:00:00Z', direction: 'rx', hex: 'AA 55 03 10 01 02 15' },
    ] }));
    render(<FrameTool />);

    await waitFor(() => expect(screen.getByText(/已接收真实通信数据/)).toBeVisible());
    expect(screen.getByLabelText('连续字节流 HEX')).toHaveValue('AA 55 03 10 01 02 15');
    expect(screen.getByText('识别 1 帧')).toBeVisible();
    expect(screen.getByText(/通信来源会写入 JSON 分析证据/)).toBeVisible();
  });
});
