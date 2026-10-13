import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import DataManagementPage from './DataManagementPage';

describe('DataManagementPage', () => {
  beforeEach(() => localStorage.clear());

  it('explains merge and privacy boundaries before any data action', () => {
    render(<DataManagementPage />);

    expect(screen.getByRole('heading', { name: '工作区备份与恢复' })).toBeVisible();
    expect(screen.getByRole('button', { name: '下载备份' })).toBeEnabled();
    expect(screen.getByLabelText('选择备份文件')).toBeVisible();
    expect(screen.getByText('AI 密钥、密码和授权令牌')).toBeVisible();
    expect(screen.getByText(/同 ID 数据仅在确认后合并/)).toBeVisible();
    expect(screen.getByText(/未发现损坏或超限/)).toBeVisible();
  });

  it('shows and explicitly clears only broken local preferences', () => {
    localStorage.setItem('embedkit.serial.shortcuts', '{broken');
    render(<DataManagementPage />);

    expect(screen.getByText('串口快捷指令')).toBeVisible();
    expect(screen.getByText(/内容损坏/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /清理 1 项异常偏好/ }));
    expect(localStorage.getItem('embedkit.serial.shortcuts')).toBeNull();
    expect(screen.getByText(/未发现损坏或超限/)).toBeVisible();
    expect(screen.getByText(/已清理 1 项/)).toBeVisible();
  });
});
