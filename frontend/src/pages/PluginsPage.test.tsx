import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import PluginsPage from './PluginsPage';

const manifest = { schemaVersion: 1, id: 'vendor.map-parser', name: 'Vendor MAP Parser', version: '1.2.0', apiVersion: 1, description: 'MAP parser', scope: 'Vendor v3', compatibility: '>=1 <2', capabilities: [{ id: 'map.vendor-v3', kind: 'map-format' }], testSamples: ['fixture.map'], fallbackBehavior: 'Retain raw input.' };

describe('extension registry page', () => {
  beforeEach(() => localStorage.clear());
  it('imports, searches, persists, and removes a validated manifest', async () => {
    const { unmount } = render(<PluginsPage />);
    fireEvent.change(screen.getByLabelText('导入扩展清单'), { target: { files: [new File([JSON.stringify(manifest)], 'manifest.json', { type: 'application/json' })] } });
    expect(await screen.findByText('Vendor MAP Parser')).toBeVisible();
    expect(screen.getByText(/仅保存清单元数据/)).toBeVisible();
    fireEvent.change(screen.getByLabelText('搜索扩展'), { target: { value: 'map.vendor-v3' } });
    expect(screen.getByText('map-format · map.vendor-v3')).toBeVisible();
    unmount();
    render(<PluginsPage />);
    const registry = screen.getByRole('region', { name: '已登记扩展' });
    expect(within(registry).getByText('Vendor MAP Parser')).toBeVisible();
    fireEvent.click(screen.getByLabelText('移除 Vendor MAP Parser'));
    await waitFor(() => expect(within(registry).queryByText('Vendor MAP Parser')).not.toBeInTheDocument());
  });
});
