import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DataManagementPage from './DataManagementPage';

describe('DataManagementPage', () => {
  it('explains merge and privacy boundaries before any data action', () => {
    render(<DataManagementPage />);

    expect(screen.getByRole('heading', { name: '工作区备份与恢复' })).toBeVisible();
    expect(screen.getByRole('button', { name: '下载备份' })).toBeEnabled();
    expect(screen.getByLabelText('选择备份文件')).toBeVisible();
    expect(screen.getByText('AI 密钥、密码和授权令牌')).toBeVisible();
    expect(screen.getByText(/同 ID 数据仅在确认后合并/)).toBeVisible();
  });
});
