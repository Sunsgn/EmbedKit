import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ModbusTool from './ModbusTool';

describe('ModbusTool protocol-table workflow', () => {
  it('decodes a real response using a pasted vendor register table', () => {
    render(<ModbusTool />);
    fireEvent.click(screen.getByRole('button', { name: 'Modbus TCP' }));
    fireEvent.change(screen.getByPlaceholderText(/至少包含/), { target: { value: '名称,区域,地址,类型,倍率,单位\n温度,03,40001,i16,0.1,℃' } });
    fireEvent.change(screen.getByPlaceholderText(/粘贴串口/), { target: { value: '00 01 00 00 00 07 01 03 04 FF 9C 00 00' } });

    expect(screen.getByText(/已载入/)).toBeVisible();
    expect(screen.getByText('温度')).toBeVisible();
    expect(screen.getByText('-100')).toBeVisible();
    expect(screen.getByText('-10')).toBeVisible();
    expect(screen.getByText('℃')).toBeVisible();
    expect(screen.getByRole('button', { name: /导出 CSV/ })).toBeEnabled();
  });
});
