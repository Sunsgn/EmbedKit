import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EngineeringProjectsPage from './EngineeringProjectsPage';
import { listEngineeringProjects, saveEngineeringProject } from '../services/productStorage';

vi.mock('../services/productStorage', () => ({ deleteEngineeringProject: vi.fn(), listEngineeringProjects: vi.fn(), saveEngineeringProject: vi.fn() }));

describe('EngineeringProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listEngineeringProjects).mockResolvedValue([{ schemaVersion: 3, id: 'project-1', name: '控制器工程', productModel: 'EK-1', chipModel: 'Generic MCU', description: '', tags: [], features: [], environmentRequirements: [], resourceLinks: [], createdAt: '', updatedAt: '2026-10-15T00:00:00.000Z' }]);
    vi.mocked(saveEngineeringProject).mockResolvedValue();
  });

  it('contains only engineering metadata, features and environment requirements', async () => {
    render(<EngineeringProjectsPage />);
    expect(await screen.findByDisplayValue('控制器工程')).toBeVisible();
    expect(screen.getByText('程序功能')).toBeVisible();
    expect(screen.getByText('开发环境需求')).toBeVisible();
    expect(screen.queryByText('测试设备')).not.toBeInTheDocument();
    expect(screen.queryByText('通道配置')).not.toBeInTheDocument();
    expect(screen.queryByText('设为当前设备')).not.toBeInTheDocument();
  });
});
