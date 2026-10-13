import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import HardFaultTool from './HardFaultTool';

const renderTool = () => render(<MemoryRouter><HardFaultTool /></MemoryRouter>);

describe('HardFaultTool real-log workflow', () => {
  it('extracts line evidence and applies recognized registers without hiding missing data', () => {
    renderTool();
    fireEvent.change(screen.getByLabelText('HardFault 原始日志'), { target: { value: 'R0=00000001 LR=FFFFFFF9 PC=0800ABCD xPSR=01000000\nCFSR=00008200 HFSR=40000000 BFAR=20010000' } });

    expect(screen.getByText('提取 7 项')).toBeVisible();
    expect(screen.getByText(/日志未提取/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '应用到寄存器表单' }));
    expect(screen.getByLabelText('寄存器 PC')).toHaveValue('0800ABCD');
    expect(screen.getByText(/PRECISERR/)).toBeVisible();
    expect(screen.getByRole('link', { name: '用 ELF 定位 PC' })).toHaveAttribute('href', expect.stringContaining('800ABCD'));
  });

  it('rejects prose without register evidence instead of guessing', () => {
    renderTool();
    fireEvent.change(screen.getByLabelText('HardFault 原始日志'), { target: { value: 'device rebooted after an unknown panic' } });
    expect(screen.getByRole('alert')).toHaveTextContent('未识别到 Cortex-M 寄存器');
  });
});
