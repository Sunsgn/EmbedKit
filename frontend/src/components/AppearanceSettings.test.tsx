import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppearanceSettings from './AppearanceSettings';
import { DEFAULT_APPEARANCE } from '../services/appearance';

describe('AppearanceSettings', () => {
  it('selects a mode and exposes persistence failures', () => {
    const onChange = vi.fn();
    render(<AppearanceSettings open value={DEFAULT_APPEARANCE} saveFailed onChange={onChange} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: '浅色' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ colorMode: 'light' }));
    expect(screen.getByRole('alert')).toHaveTextContent('浏览器拒绝保存设置');
  });

  it('is not mounted while closed', () => {
    render(<AppearanceSettings open={false} value={DEFAULT_APPEARANCE} saveFailed={false} onChange={() => undefined} onClose={() => undefined} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
