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

  it('reports a damaged PDF instead of pretending extraction succeeded', async () => {
    render(<FrameTool />);
    const file = new File(['%PDF'], 'protocol.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('导入协议资料'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/PDF 读取失败/));
  }, 20_000);

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

  it('extracts and deterministically decodes payload field tables', () => {
    render(<FrameTool />);
    const source = '帧头：AA 55\n长度字段：1 字节\n命令码宽度：1 字节\n校验：SUM8\n字段,偏移,长度,类型,字节序,倍率,单位,枚举\n温度,0,2,int16,小端,0.1,℃,\n状态,2,1,u8,大端,1,,0=关闭;1=开启';
    fireEvent.change(screen.getByLabelText('协议资料原文'), { target: { value: source } });
    fireEvent.click(screen.getByRole('button', { name: '提取候选结构' }));
    expect(screen.getByText('温度')).toBeVisible();
    expect(screen.getByText('状态')).toBeVisible();
    fireEvent.change(screen.getByLabelText('待解析帧 HEX'), { target: { value: 'AA 55 04 10 9C FF 01 AF' } });
    expect(screen.getByText('-10 ℃（9C FF）')).toBeVisible();
    expect(screen.getByText('开启（01）')).toBeVisible();
  });

  it('recognizes and presents the protocol framework instead of only extracting file text', () => {
    render(<FrameTool />);
    const source = 'Modbus RTU 使用 RS485 串口，采用主从请求响应方式\n帧头：AA 55\n长度字段：1 字节\n命令码宽度：1 字节\n校验：CRC16-Modbus\n帧字段,偏移,长度\n帧头,0,2\n地址,2,1\n长度,3,1\n命令码,4,1\n数据,5,可变\nCRC,可变,2\n命令码,命令名称,方向\n0x10,读取温度,请求\n0x90,读取温度响应,响应';
    fireEvent.change(screen.getByLabelText('协议资料原文'), { target: { value: source } });
    fireEvent.click(screen.getByRole('button', { name: '提取候选结构' }));
    const framework = screen.getByRole('region', { name: '协议框架识别结果' });
    expect(framework).toHaveTextContent('协议族：Modbus RTU');
    expect(framework).toHaveTextContent('传输：UART、RS-485');
    expect(framework).toHaveTextContent('交互：请求/响应、主从');
    expect(framework).toHaveTextContent('命令 / 消息目录（2）');
    expect(framework).toHaveTextContent('读取温度响应');
  });
});
