import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import IntelHexTool from './IntelHexTool';
import { readLocalFileBytes, revokeLocalPath } from '../../services/localFiles';

vi.mock('../../services/localFiles', () => ({ readLocalFileBytes: vi.fn(), revokeLocalPath: vi.fn() }));
const hex = ':020000040800F2\n:0400100001020304E2\n:00000001FF';

describe('IntelHexTool authorized build artifact workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readLocalFileBytes).mockResolvedValue({ metadata: { id: 'selection-hex', kind: 'file', name: 'app.hex', size: hex.length, modifiedAt: '', expiresAt: '' }, bytes: new TextEncoder().encode(hex) });
    vi.mocked(revokeLocalPath).mockResolvedValue({ revoked: true });
  });

  it('loads, validates, and revokes an authorized build HEX artifact', async () => {
    render(<MemoryRouter initialEntries={[{ pathname: '/toolbox/ihex', state: { selectionId: 'selection-hex', fileName: 'release.hex', source: 'build-artifact' } }]}><IntelHexTool /></MemoryRouter>);
    await waitFor(() => expect(readLocalFileBytes).toHaveBeenCalledWith('selection-hex', 16 * 1024 * 1024, expect.any(Function)));
    await waitFor(() => expect(revokeLocalPath).toHaveBeenCalledWith('selection-hex'));
    expect(screen.getByText('release.hex')).toBeVisible();
    expect(screen.getByText('3 / 1')).toBeVisible();
    expect(screen.getByText('已发现')).toBeVisible();
  });
});
