import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ToolboxPage from './ToolboxPage';

describe('ToolboxPage focused tool workspace', () => {
  it('shows only the catalog before a tool is selected', () => {
    render(<ToolboxPage />);

    expect(screen.getByText('从左侧选择一个工具')).toBeVisible();
    expect(screen.getByRole('navigation', { name: '嵌入式工具目录' }).querySelectorAll('button')).toHaveLength(10);
    expect(screen.queryByText('Modbus 线序')).not.toBeInTheDocument();
    expect(screen.queryByText('每帧位数')).not.toBeInTheDocument();
  });

  it('opens one tool at a time and can return to the catalog', () => {
    render(<ToolboxPage />);

    fireEvent.click(screen.getByRole('button', { name: /CRC 与字节序/ }));
    expect(screen.getByText('Modbus 线序')).toBeVisible();
    expect(screen.queryByText('每帧位数')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /UART 传输时间/ }));
    expect(screen.getByText('每帧位数')).toBeVisible();
    expect(screen.queryByText('Modbus 线序')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /CAN 帧分析/ }));
    expect(screen.getByText('基础帧长度')).toBeVisible();
    expect(screen.queryByText('每帧位数')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '关闭当前工具' }));
    expect(screen.getByText('从左侧选择一个工具')).toBeVisible();
  });
});
