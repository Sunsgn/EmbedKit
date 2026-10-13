import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CrcTool from './CrcTool';

describe('CrcTool engineering workflow', () => {
  it('selects a named model and calculates a documented check vector', () => {
    render(<CrcTool />);
    fireEvent.click(screen.getByRole('button', { name: 'UTF-8 文本' }));
    fireEvent.change(screen.getByLabelText('CRC 输入'), { target: { value: '123456789' } });
    fireEvent.change(screen.getByLabelText('CRC 参数模型'), { target: { value: 'crc16-ccitt-false' } });

    expect(screen.getByText('0x29B1')).toBeVisible();
    expect(screen.getByText('0..9（9/9 字节）')).toBeVisible();
  });

  it('keeps valid batch frames when another row is damaged', () => {
    render(<CrcTool />);
    fireEvent.click(screen.getByLabelText('每行一帧批量计算'));
    fireEvent.change(screen.getByLabelText('CRC 输入'), { target: { value: '01 03\nnot-hex\n12 34' } });

    expect(screen.getAllByText('正常')).toHaveLength(2);
    expect(screen.getByText(/HEX 数据必须/)).toBeVisible();
  });

  it('exposes custom parameters and generated C with verification guidance', () => {
    render(<CrcTool />);
    fireEvent.change(screen.getByLabelText('CRC 参数模型'), { target: { value: 'custom' } });
    expect(screen.getByLabelText('CRC 多项式')).toHaveValue('0x8005');
    fireEvent.click(screen.getByText('生成可移植 C 参考实现'));
    expect((screen.getByLabelText('CRC C 代码') as HTMLTextAreaElement).value).toContain('crc_compute');
    expect(screen.getByText(/check 向量/)).toBeVisible();
  });
});
