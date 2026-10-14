import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import FirmwareTool from './FirmwareTool';
import { readLocalFileBytes, revokeLocalPath } from '../../services/localFiles';
import { createFirmwareIdentityRecords } from '../../services/firmwareIdentity';
import { saveFirmwareArtifactIdentity } from '../../services/productStorage';

vi.mock('../../services/localFiles', () => ({ readLocalFileBytes: vi.fn(), revokeLocalPath: vi.fn() }));
vi.mock('../../services/firmwareIdentity', () => ({ createFirmwareIdentityRecords: vi.fn() }));
vi.mock('../../services/productStorage', () => ({ saveFirmwareArtifactIdentity: vi.fn() }));

describe('FirmwareTool authorized build artifact workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readLocalFileBytes).mockResolvedValue({ metadata: { id: 'selection-bin', kind: 'file', name: 'app.bin', size: 4, modifiedAt: '', expiresAt: '' }, bytes: new Uint8Array([1, 2, 3, 4]) });
    vi.mocked(revokeLocalPath).mockResolvedValue({ revoked: true });
    vi.mocked(createFirmwareIdentityRecords).mockResolvedValue({
      artifact: { schemaVersion: 1, id: 'artifact-1', buildId: 'build-bin', kind: 'bin', fileName: 'release.bin', byteLength: 4, sha256: 'a'.repeat(64), capturedAt: '2026-10-14T00:00:00.000Z' },
      firmware: { schemaVersion: 1, id: 'firmware-1', buildArtifactId: 'artifact-1', sha256: 'a'.repeat(64), byteLength: 4, format: 'bin', capturedAt: '2026-10-14T00:00:00.000Z' },
    });
    vi.mocked(saveFirmwareArtifactIdentity).mockResolvedValue();
  });

  it('loads a build BIN into the first segment, requires base-address confirmation, and revokes access', async () => {
    render(<MemoryRouter initialEntries={[{ pathname: '/toolbox/firmware', state: { selectionId: 'selection-bin', fileName: 'release.bin', source: 'build-artifact', buildId: 'build-bin', artifactIndex: 0, artifactType: 'bin', size: 4, modifiedAt: '2026-10-12T00:00:00.000Z' } }]}><FirmwareTool /></MemoryRouter>);
    await waitFor(() => expect(readLocalFileBytes).toHaveBeenCalledWith('selection-bin', 32 * 1024 * 1024, expect.any(Function)));
    await waitFor(() => expect(revokeLocalPath).toHaveBeenCalledWith('selection-bin'));
    await waitFor(() => expect(saveFirmwareArtifactIdentity).toHaveBeenCalled());
    expect(screen.getByText(/release\.bin（4 B）/)).toBeVisible();
    expect(screen.getByText(/BIN 不包含加载地址，请确认/)).toBeVisible();
    expect(screen.getByText('当前产物已记录')).toBeVisible();
    expect(screen.getByText('4 B / 0 B')).toBeVisible();
    expect(screen.getByRole('button', { name: '导出发布清单' })).toBeEnabled();
    expect(screen.getByText(/固件身份已保存.*SHA-256/)).toBeVisible();
  });

  it('keeps analysis available but marks the build record failed when fingerprint verification fails', async () => {
    vi.mocked(createFirmwareIdentityRecords).mockRejectedValue(new Error('构建记录 SHA-256 与实际读取文件不一致'));
    render(<MemoryRouter initialEntries={[{ pathname: '/toolbox/firmware', state: { selectionId: 'selection-bin', fileName: 'release.bin', source: 'build-artifact', buildId: 'build-bin', artifactIndex: 0, artifactType: 'bin', size: 4, modifiedAt: '2026-10-12T00:00:00.000Z', sha256: 'f'.repeat(64) } }]}><FirmwareTool /></MemoryRouter>);

    expect(await screen.findByRole('alert')).toHaveTextContent(/固件身份未保存.*SHA-256.*不一致/);
    expect(screen.getByText(/release\.bin（4 B）/)).toBeVisible();
    expect(screen.getByText('当前产物分析失败')).toBeVisible();
    expect(saveFirmwareArtifactIdentity).not.toHaveBeenCalled();
    await waitFor(() => expect(revokeLocalPath).toHaveBeenCalledWith('selection-bin'));
  });
});
