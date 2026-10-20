import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import ChipLibPage from './ChipLibPage';

beforeEach(() => localStorage.clear());

describe('ChipLibPage layout', () => {
  it('keeps catalog, functional selection, and records in mutually exclusive workspaces', () => {
    render(<ChipLibPage />);
    expect(screen.getByPlaceholderText(/搜索型号、参数或用途/)).toBeInTheDocument();
    expect(screen.queryByText('功能方案工作台')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /按功能设计方案/ }));
    expect(screen.getByText('功能方案工作台')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/搜索型号、参数或用途/)).not.toBeInTheDocument();
    expect(localStorage.getItem('embedkit.resources-mode')).toBe('solution');
    fireEvent.click(screen.getByRole('button', { name: /我的资料与选型记录/ }));
    expect(screen.getByRole('heading', { name: '我的资料与选型记录' })).toBeInTheDocument();
    expect(screen.queryByText('功能方案工作台')).not.toBeInTheDocument();
  });
});
