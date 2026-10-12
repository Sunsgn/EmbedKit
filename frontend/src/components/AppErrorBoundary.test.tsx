import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppErrorBoundary from './AppErrorBoundary';

function BrokenPage({ fail = true }: { fail?: boolean }) {
  if (fail) throw new Error('C:\\Users\\developer\\secret-project\\main.c:42 private stack');
  return <p>页面内容正常</p>;
}

describe('AppErrorBoundary', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => undefined));

  it('isolates a page failure without exposing exception details', () => {
    render(<AppErrorBoundary resetKey="/projects" onHome={vi.fn()}><BrokenPage /></AppErrorBoundary>);

    expect(screen.getByRole('alert')).toHaveTextContent('当前页面运行异常');
    expect(screen.queryByText(/secret-project|main\.c|private stack/)).not.toBeInTheDocument();
  });

  it('retries a transient page failure', () => {
    let shouldFail = true;
    function TransientPage() {
      if (shouldFail) throw new Error('temporary');
      return <p>页面已恢复</p>;
    }

    render(<AppErrorBoundary resetKey="/tests" onHome={vi.fn()}><TransientPage /></AppErrorBoundary>);
    shouldFail = false;
    fireEvent.click(screen.getByRole('button', { name: '重试当前页面' }));

    expect(screen.getByText('页面已恢复')).toBeVisible();
  });

  it('recovers when navigation changes the reset key', () => {
    const { rerender } = render(<AppErrorBoundary resetKey="/broken" onHome={vi.fn()}><BrokenPage /></AppErrorBoundary>);
    rerender(<AppErrorBoundary resetKey="/devices" onHome={vi.fn()}><BrokenPage fail={false} /></AppErrorBoundary>);

    expect(screen.getByText('页面内容正常')).toBeVisible();
  });

  it('offers explicit home and full reload recovery actions', () => {
    const onHome = vi.fn();
    const onReload = vi.fn();
    render(<AppErrorBoundary resetKey="/ai" onHome={onHome} onReload={onReload}><BrokenPage /></AppErrorBoundary>);

    fireEvent.click(screen.getByRole('button', { name: '重新加载应用' }));
    expect(onReload).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: '返回工作台' }));
    expect(onHome).toHaveBeenCalledOnce();
  });

  it('does not affect healthy pages', () => {
    render(<AppErrorBoundary resetKey="/" onHome={vi.fn()}><BrokenPage fail={false} /></AppErrorBoundary>);
    expect(screen.getByText('页面内容正常')).toBeVisible();
  });
});
