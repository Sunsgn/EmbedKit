import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MapTool from './MapTool';
import { readLocalFileBytes, revokeLocalPath } from '../../services/localFiles';

vi.mock('../../services/localFiles', () => ({
  readLocalFileBytes: vi.fn(), revokeLocalPath: vi.fn(),
}));

const map = `Memory Configuration
FLASH 0x08000000 0x1000 xr
Linker script and memory map
.text 0x08000000 0x100
                0x08000000 0x10 main`;
const keilMap = (code: number, zi: number) => `ARM Linker, 5.06
Memory Map of the image
Execution Region ER_IROM1 (Exec base: 0x08000000, Load base: 0x08000000, Size: 0x00001000, Max: 0x00010000)
Image component sizes
   ${code}          0         20          8         ${zi}          0   network.o
  0x08000000 0x20 Code RO 1 .text network.o
  network_run 0x08000000 Thumb 32 network.o`;

describe('MAP address workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readLocalFileBytes).mockResolvedValue({ metadata: { id: 'selection-map', kind: 'file', name: 'firmware.map', size: map.length, modifiedAt: '', expiresAt: '' }, bytes: new TextEncoder().encode(map) });
    vi.mocked(revokeLocalPath).mockResolvedValue({ revoked: true });
  });
  it('locates an address with MAP evidence and offers explicit ELF refinement', async () => {
    render(<MemoryRouter><MapTool /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText('粘贴 MAP 内容，或导入 .map 文件'), { target: { value: map } });
    expect(await screen.findByText('GNU ld / LLVM lld / ESP-IDF')).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText('例如 0x08001234'), { target: { value: '0x08000008' } });
    fireEvent.click(screen.getByRole('button', { name: 'MAP 定位' }));
    expect(screen.getByText('main + 0x8')).toBeVisible();
    expect(screen.getByText('inside-symbol / high')).toBeVisible();
    expect(screen.getByRole('link', { name: '用 ELF 深度定位' })).toHaveAttribute('href', '/toolbox/elf?address=0x08000008&source=map');
  });

  it('reports invalid addresses without hiding the MAP analysis', async () => {
    render(<MemoryRouter><MapTool /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText('粘贴 MAP 内容，或导入 .map 文件'), { target: { value: map } });
    expect(await screen.findByText('GNU ld / LLVM lld / ESP-IDF')).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText('例如 0x08001234'), { target: { value: 'main+4' } });
    fireEvent.click(screen.getByRole('button', { name: 'MAP 定位' }));
    expect(screen.getByText(/地址必须/)).toBeVisible();
  });

  it('reads, analyzes, and revokes an authorized build MAP artifact', async () => {
    render(<MemoryRouter initialEntries={[{ pathname: '/toolbox/map', state: { selectionId: 'selection-map', fileName: 'firmware.map', source: 'build-artifact', buildId: 'build-map', artifactIndex: 0, artifactType: 'map', size: map.length, modifiedAt: '2026-10-12T00:00:00.000Z' } }]}><MapTool /></MemoryRouter>);
    await waitFor(() => expect(readLocalFileBytes).toHaveBeenCalledWith('selection-map', 16 * 1024 * 1024, expect.any(Function)));
    await waitFor(() => expect(revokeLocalPath).toHaveBeenCalledWith('selection-map'));
    expect(await screen.findByText(/firmware\.map/)).toBeVisible();
    expect(await screen.findByText('GNU ld / LLVM lld / ESP-IDF')).toBeVisible();
    expect(screen.getByText('当前产物已记录')).toBeVisible();
  });

  it('rejects oversized authorized MAP files and still revokes the token', async () => {
    vi.mocked(readLocalFileBytes).mockRejectedValue(new Error('文件大小 16777217 B 超过 16777216 B 上限'));
    render(<MemoryRouter initialEntries={[{ pathname: '/toolbox/map', state: { selectionId: 'selection-map', fileName: 'huge.map', source: 'build-artifact', buildId: 'build-map', artifactIndex: 1, artifactType: 'map', size: 16 * 1024 * 1024 + 1, modifiedAt: '2026-10-12T00:00:00.000Z' } }]}><MapTool /></MemoryRouter>);
    expect(await screen.findByText(/超过.*上限/)).toBeVisible();
    expect(readLocalFileBytes).toHaveBeenCalled();
    await waitFor(() => expect(revokeLocalPath).toHaveBeenCalledWith('selection-map'));
    expect(screen.getByText('当前产物分析失败')).toBeVisible();
  });

  it('compares a baseline, drills into module evidence, and clears only the comparison', async () => {
    render(<MemoryRouter><MapTool /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText('粘贴 MAP 内容，或导入 .map 文件'), { target: { value: keilMap(240, 96) } });
    expect(await screen.findByText('Keil ARMCC / armlink 5')).toBeVisible();
    fireEvent.change(screen.getByLabelText('基线 MAP 内容'), { target: { value: keilMap(160, 64) } });
    expect(await screen.findByText('容量增长')).toBeVisible();
    expect(screen.getByText('对比置信度：high')).toBeVisible();
    fireEvent.click(screen.getByText('network.o'));
    expect(await screen.findByText('network.o 贡献证据')).toBeVisible();
    expect(screen.getByRole('button', { name: 'JSON 证据' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '清除基线' }));
    expect(screen.queryByText('容量增长')).not.toBeInTheDocument();
    expect(screen.getByText('Keil ARMCC / armlink 5')).toBeVisible();
  });

  it('rejects an oversized baseline without discarding the current analysis', async () => {
    render(<MemoryRouter><MapTool /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText('粘贴 MAP 内容，或导入 .map 文件'), { target: { value: map } });
    expect(await screen.findByText('GNU ld / LLVM lld / ESP-IDF')).toBeVisible();
    const file = new File(['x'], 'huge.map', { type: 'text/plain' });
    Object.defineProperty(file, 'size', { value: 16 * 1024 * 1024 + 1 });
    fireEvent.change(screen.getByLabelText('导入基线 MAP'), { target: { files: [file] } });
    expect(await screen.findByText(/基线 MAP 文件超过/)).toBeVisible();
    expect(screen.getByText('GNU ld / LLVM lld / ESP-IDF')).toBeVisible();
  });
});
