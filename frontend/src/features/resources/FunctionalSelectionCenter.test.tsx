import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import FunctionalSelectionCenter from './FunctionalSelectionCenter';

beforeEach(() => localStorage.clear());
describe('FunctionalSelectionCenter', () => {
  it('uses editable roles and dynamic constraints instead of fixed part-category pages', () => {
    render(<FunctionalSelectionCenter />);
    expect(screen.getByText('开始方案选型与验证')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /从模板开始/ }));
    fireEvent.click(screen.getByRole('button', { name: '进入核验工作区' }));
    expect(screen.getByText('方案核验工作台')).toBeInTheDocument();
    expect(screen.getAllByText('控制器').length).toBeGreaterThan(0);
    expect(screen.getByText('接口保护')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '添加参数' }));
    expect(screen.getAllByText('最高主频').length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole('button', { name: /加载本地候选/ }));
    expect(screen.getByText('STM32F103RCT6')).toBeInTheDocument();
  });

  it('restores an unfinished workspace after the page is reopened', () => {
    const view = render(<FunctionalSelectionCenter />);
    fireEvent.click(screen.getByRole('button', { name: /从模板开始/ }));
    fireEvent.click(screen.getByRole('button', { name: '进入核验工作区' }));
    fireEvent.change(screen.getByRole('textbox', { name: '方案名称' }), { target: { value: '现场控制器候选核验' } });
    view.unmount();

    render(<FunctionalSelectionCenter />);
    expect(screen.getByText(/恢复未保存工作区：现场控制器候选核验/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '恢复' }));
    expect(screen.getByRole('textbox', { name: '方案名称' })).toHaveValue('现场控制器候选核验');
  });
});
