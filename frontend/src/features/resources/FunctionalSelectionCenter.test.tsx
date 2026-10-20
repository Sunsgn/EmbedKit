import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import FunctionalSelectionCenter from './FunctionalSelectionCenter';

beforeEach(() => localStorage.clear());
describe('FunctionalSelectionCenter', () => {
  it('starts from a pasted requirement without choosing a workflow first', () => {
    render(<FunctionalSelectionCenter />);
    fireEvent.change(screen.getByRole('textbox', { name: '需求或候选内容' }), { target: { value: '温度和压力传感器采集，需要 ADC' } });
    expect(screen.getByText(/建议结构：传感器采集节点 · 预计加载 \d+ 个本地候选/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '按需求开始' }));
    expect(screen.getByText('方案核验工作台')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '功能描述' })).toHaveValue('温度和压力传感器采集，需要 ADC');
    expect(screen.getByText('BME280')).toBeInTheDocument();
    expect(screen.getByText(/已发现 \d+ 个候选/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '在线查询器件型号' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '补充其他型号' }));
    expect(screen.getByRole('textbox', { name: '在线查询器件型号' })).toBeInTheDocument();
  });

  it('uses editable roles and dynamic constraints instead of fixed part-category pages', () => {
    render(<FunctionalSelectionCenter />);
    expect(screen.getByRole('heading', { name: '方案选型与验证' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /从模板或空白方案开始/ }));
    fireEvent.click(screen.getByRole('button', { name: '进入工作区' }));
    expect(screen.getByText('方案核验工作台')).toBeInTheDocument();
    expect(screen.getAllByText('控制器').length).toBeGreaterThan(0);
    expect(screen.getAllByText('接口保护').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '添加参数' }));
    expect(screen.getAllByText('最高主频').length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole('button', { name: /加载本地候选/ }));
    expect(screen.getByText('STM32F103RCT6')).toBeInTheDocument();
  });

  it('restores an unfinished workspace after the page is reopened', () => {
    const view = render(<FunctionalSelectionCenter />);
    fireEvent.click(screen.getByRole('button', { name: /从模板或空白方案开始/ }));
    fireEvent.click(screen.getByRole('button', { name: '进入工作区' }));
    fireEvent.change(screen.getByRole('textbox', { name: '方案名称' }), { target: { value: '现场控制器候选核验' } });
    view.unmount();

    render(<FunctionalSelectionCenter />);
    expect(screen.getByText(/未完成：现场控制器候选核验/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '继续' }));
    expect(screen.getByRole('textbox', { name: '方案名称' })).toHaveValue('现场控制器候选核验');
  });
});
