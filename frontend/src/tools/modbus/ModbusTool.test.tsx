import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ModbusTool from './ModbusTool';

describe('ModbusTool protocol-table workflow', () => {
  it('decodes a real response using a pasted vendor register table', () => {
    render(<ModbusTool />);
    fireEvent.click(screen.getByRole('button', { name: 'Modbus TCP' }));
    fireEvent.change(screen.getByPlaceholderText(/厂家 PDF/), { target: { value: '名称,区域,地址,类型,倍率,单位\n温度,03,40001,i16,0.1,℃' } });
    fireEvent.change(screen.getByPlaceholderText(/粘贴串口/), { target: { value: '00 01 00 00 00 07 01 03 04 FF 9C 00 00' } });

    expect(screen.getByText(/已载入/)).toBeVisible();
    expect(screen.getAllByText('温度')).toHaveLength(2);
    expect(screen.getByText('-100')).toBeVisible();
    expect(screen.getByText('-10')).toBeVisible();
    expect(screen.getAllByText('℃')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /导出 CSV/ })).toBeEnabled();
  });

  it('lets users map non-standard columns copied from a manufacturer document', () => {
    render(<ModbusTool />);
    fireEvent.change(screen.getByPlaceholderText(/厂家 PDF/), { target: { value: '项目说明 | 编号 | 格式 | 量纲\n出口温度 | 40001 | int16 | ℃' } });
    expect(screen.getByText(/置信度/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '调整列映射' }));
    fireEvent.change(screen.getByLabelText('映射名称列'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('映射地址列'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('映射数据类型列'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('映射单位列'), { target: { value: '3' } });

    expect(screen.getByText(/已载入/)).toBeVisible();
  });
});
