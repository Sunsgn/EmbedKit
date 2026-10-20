import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import ChipLibPage from './ChipLibPage';

beforeEach(() => localStorage.clear());

describe('ChipLibPage layout', () => {
  it('keeps catalog, functional selection, and records in mutually exclusive workspaces', () => {
    render(<ChipLibPage />);
    expect(screen.getByPlaceholderText(/搜索型号、参数或用途/)).toBeInTheDocument();
    expect(screen.queryByText('开始方案选型与验证')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /方案选型与验证/ }));
    expect(screen.getByText('开始方案选型与验证')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/搜索型号、参数或用途/)).not.toBeInTheDocument();
    expect(localStorage.getItem('embedkit.resources-mode')).toBe('solution');
    fireEvent.click(screen.getByRole('button', { name: /我的资料与选型记录/ }));
    expect(screen.getByRole('heading', { name: '我的资料与选型记录' })).toBeInTheDocument();
    expect(screen.queryByText('开始方案选型与验证')).not.toBeInTheDocument();
  });

  it('carries pasted recommendation candidates into the verification workspace', () => {
    render(<ChipLibPage />);
    fireEvent.click(screen.getByRole('button', { name: /方案选型与验证/ }));
    fireEvent.click(screen.getByRole('button', { name: /粘贴 AI/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '方案输入内容' }), { target: { value: '推荐 STM32G474RET6 和 S32K144' } });
    expect(screen.getByText('STM32G474RET6')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '进入核验工作区' }));
    expect(screen.getByText('方案核验工作台')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '推荐文本' })).toHaveValue('推荐 STM32G474RET6 和 S32K144');
    expect(screen.getByText(/识别 2 个候选/)).toBeInTheDocument();
  });
});
