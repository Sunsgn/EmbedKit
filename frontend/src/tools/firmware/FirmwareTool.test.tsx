import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import FirmwareTool from './FirmwareTool';
import { readLocalFileBytes, revokeLocalPath } from '../../services/localFiles';

vi.mock('../../services/localFiles', () => ({ readLocalFileBytes: vi.fn(), revokeLocalPath: vi.fn() }));

describe('FirmwareTool authorized build artifact workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readLocalFileBytes).mockResolvedValue({ metadata: { id: 'selection-bin', kind: 'file', name: 'app.bin', size: 4, modifiedAt: '', expiresAt: '' }, bytes: new Uint8Array([1, 2, 3, 4]) });
    vi.mocked(revokeLocalPath).mockResolvedValue({ revoked: true });
  });

  it('loads a build BIN into the first segment, requires base-address confirmation, and revokes access', async () => {
    render(<MemoryRouter initialEntries={[{ pathname: '/toolbox/firmware', state: { selectionId: 'selection-bin', fileName: 'release.bin', source: 'build-artifact' } }]}><FirmwareTool /></MemoryRouter>);
    await waitFor(() => expect(readLocalFileBytes).toHaveBeenCalledWith('selection-bin', 32 * 1024 * 1024, expect.any(Function)));
    await waitFor(() => expect(revokeLocalPath).toHaveBeenCalledWith('selection-bin'));
    expect(screen.getByText(/release\.bin（4 B）/)).toBeVisible();
    expect(screen.getByText(/BIN 不包含加载地址，请确认/)).toBeVisible();
  });
});
