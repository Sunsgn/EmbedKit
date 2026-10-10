import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ToolboxPage from './ToolboxPage';
import ToolWorkspacePage from './ToolWorkspacePage';

function renderToolbox(initial = '/toolbox') {
  return render(<MemoryRouter initialEntries={[initial]}><Routes><Route path="/toolbox" element={<ToolboxPage />} /><Route path="/toolbox/:toolId" element={<ToolWorkspacePage />} /></Routes></MemoryRouter>);
}

describe('ToolboxPage independent tool workspace', () => {
  it('shows the catalog without mounting every tool', () => {
    renderToolbox();
    expect(screen.getByRole('navigation', { name: '嵌入式工具目录' }).querySelectorAll('button')).toHaveLength(10);
    expect(screen.queryByText('Modbus 线序')).not.toBeInTheDocument();
    expect(screen.queryByText('每帧位数')).not.toBeInTheDocument();
  });

  it('opens a tool at an independent route and returns to the catalog', async () => {
    renderToolbox();
    fireEvent.click(screen.getByRole('button', { name: /CRC 与字节序/ }));
    expect(await screen.findByText('Modbus 线序')).toBeVisible();
    expect(screen.queryByText('每帧位数')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '返回工具箱' }));
    expect(screen.getByRole('navigation', { name: '嵌入式工具目录' })).toBeVisible();
  });

  it('supports direct URLs and safely handles unknown tools', async () => {
    const direct = renderToolbox('/toolbox/can');
    expect(await screen.findByText('基础帧长度')).toBeVisible();
    direct.unmount();
    renderToolbox('/toolbox/not-found');
    expect(screen.getByText('未找到这个工具')).toBeVisible();
  });
});
