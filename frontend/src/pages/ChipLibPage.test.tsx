import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import ChipLibPage from './ChipLibPage';

beforeEach(() => localStorage.clear());

describe('ChipLibPage layout', () => {
  it('keeps model lookup primary and opens batch verification as a secondary workspace', () => {
    render(<ChipLibPage />);
    expect(screen.getByPlaceholderText(/搜索型号、参数或用途/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /方案选型与验证/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /批量核验 AI 给出的型号/ }));
    expect(screen.getByRole('heading', { name: '批量型号核验' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/搜索型号、参数或用途/)).not.toBeInTheDocument();
    expect(localStorage.getItem('embedkit.resources-mode')).toBe('solution');
    fireEvent.click(screen.getByRole('button', { name: /我的资料与选型记录/ }));
    expect(screen.getByRole('heading', { name: '我的资料与选型记录' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '批量型号核验' })).not.toBeInTheDocument();
  });

  it('carries pasted recommendation candidates into the verification workspace', () => {
    render(<ChipLibPage />);
    fireEvent.click(screen.getByRole('button', { name: /批量核验 AI 给出的型号/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '型号或推荐内容' }), { target: { value: '推荐 STM32G474RET6 和 S32K144' } });
    expect(screen.getByText('STM32G474RET6')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '核验 2 个型号' }));
    expect(screen.getByText('方案核验工作台')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '推荐文本' })).toHaveValue('推荐 STM32G474RET6 和 S32K144');
    expect(screen.getByText(/识别 2 个候选/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '当前角色类别' })).toHaveValue('custom');
    fireEvent.change(screen.getByRole('combobox', { name: '当前角色类别' }), { target: { value: 'mcu' } });
    expect(screen.getByRole('combobox', { name: '当前角色类别' })).toHaveValue('mcu');
  });

  it('shows a complete document package instead of only a datasheet for an exact model', () => {
    render(<ChipLibPage />);
    fireEvent.change(screen.getByPlaceholderText(/搜索型号、参数或用途/), { target: { value: 'BME280' } });
    expect(screen.getByRole('heading', { name: '完整技术资料包' })).toBeInTheDocument();
    const datasheet = screen.getAllByRole('link').find((link) => link.textContent?.startsWith('数据手册'));
    expect(datasheet).toHaveAttribute('href', expect.stringContaining('bosch-sensortec.com'));
    expect(screen.getByRole('link', { name: /用户／使用手册/ })).toHaveTextContent('官方站点定向搜索');
    expect(screen.getByRole('link', { name: /应用笔记/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /硬件设计指南/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /入门指南/ })).toBeInTheDocument();
  });
});
