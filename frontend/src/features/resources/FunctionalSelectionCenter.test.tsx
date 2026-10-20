import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import FunctionalSelectionCenter from './FunctionalSelectionCenter';

beforeEach(() => localStorage.clear());
describe('FunctionalSelectionCenter', () => {
  it('uses editable roles and dynamic constraints instead of fixed part-category pages', () => {
    render(<FunctionalSelectionCenter />);
    expect(screen.getByText('功能方案工作台')).toBeInTheDocument();
    expect(screen.getAllByText('控制器').length).toBeGreaterThan(0);
    expect(screen.getByText('接口保护')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '添加参数' }));
    expect(screen.getAllByText('最高主频').length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole('button', { name: /加载本地候选/ }));
    expect(screen.getByText('STM32F103RCT6')).toBeInTheDocument();
  });
});
