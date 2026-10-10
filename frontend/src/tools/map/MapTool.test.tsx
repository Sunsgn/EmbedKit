import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MapTool from './MapTool';
import { getLocalFileMetadata, readLocalFileChunk, revokeLocalPath } from '../../services/localFiles';

vi.mock('../../services/localFiles', () => ({
  decodeLocalFileChunk: (chunk: { data: string }) => Uint8Array.from(window.atob(chunk.data), value => value.charCodeAt(0)),
  getLocalFileMetadata: vi.fn(), readLocalFileChunk: vi.fn(), revokeLocalPath: vi.fn(),
}));

const map = `Memory Configuration
FLASH 0x08000000 0x1000 xr
Linker script and memory map
.text 0x08000000 0x100
                0x08000000 0x10 main`;

describe('MAP address workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLocalFileMetadata).mockResolvedValue({ id: 'selection-map', kind: 'file', name: 'firmware.map', size: map.length, modifiedAt: '', expiresAt: '' });
    vi.mocked(readLocalFileChunk).mockResolvedValue({ selectionId: 'selection-map', offset: 0, byteLength: map.length, size: map.length, eof: true, encoding: 'base64', data: window.btoa(map) });
    vi.mocked(revokeLocalPath).mockResolvedValue({ revoked: true });
  });
  it('locates an address with MAP evidence and offers explicit ELF refinement', () => {
    render(<MemoryRouter><MapTool /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText('粘贴 MAP 内容，或导入 .map 文件'), { target: { value: map } });
    fireEvent.change(screen.getByPlaceholderText('例如 0x08001234'), { target: { value: '0x08000008' } });
    fireEvent.click(screen.getByRole('button', { name: 'MAP 定位' }));
    expect(screen.getByText('main + 0x8')).toBeVisible();
    expect(screen.getByText('inside-symbol / high')).toBeVisible();
    expect(screen.getByRole('link', { name: '用 ELF 深度定位' })).toHaveAttribute('href', '/toolbox/elf?address=0x08000008&source=map');
  });

  it('reports invalid addresses without hiding the MAP analysis', () => {
    render(<MemoryRouter><MapTool /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText('粘贴 MAP 内容，或导入 .map 文件'), { target: { value: map } });
    fireEvent.change(screen.getByPlaceholderText('例如 0x08001234'), { target: { value: 'main+4' } });
    fireEvent.click(screen.getByRole('button', { name: 'MAP 定位' }));
    expect(screen.getByText(/地址必须/)).toBeVisible();
    expect(screen.getByText('GNU ld / LLVM lld / ESP-IDF')).toBeVisible();
  });

  it('reads, analyzes, and revokes an authorized build MAP artifact', async () => {
    render(<MemoryRouter initialEntries={[{ pathname: '/toolbox/map', state: { selectionId: 'selection-map', fileName: 'firmware.map', source: 'build-artifact' } }]}><MapTool /></MemoryRouter>);
    await waitFor(() => expect(readLocalFileChunk).toHaveBeenCalledWith('selection-map', 0, map.length));
    await waitFor(() => expect(revokeLocalPath).toHaveBeenCalledWith('selection-map'));
    expect(await screen.findByText('firmware.map')).toBeVisible();
    expect(screen.getByText('GNU ld / LLVM lld / ESP-IDF')).toBeVisible();
  });

  it('rejects oversized authorized MAP files and still revokes the token', async () => {
    vi.mocked(getLocalFileMetadata).mockResolvedValue({ id: 'selection-map', kind: 'file', name: 'huge.map', size: 16 * 1024 * 1024 + 1, modifiedAt: '', expiresAt: '' });
    render(<MemoryRouter initialEntries={[{ pathname: '/toolbox/map', state: { selectionId: 'selection-map', fileName: 'huge.map', source: 'build-artifact' } }]}><MapTool /></MemoryRouter>);
    expect(await screen.findByText(/超过 16\.00 MiB 上限/)).toBeVisible();
    expect(readLocalFileChunk).not.toHaveBeenCalled();
    await waitFor(() => expect(revokeLocalPath).toHaveBeenCalledWith('selection-map'));
  });
});
