import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FrameTool from './FrameTool';

describe('FrameTool stream workflow', () => {
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
});
