import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ElfTool from './ElfTool';
import { analyzeSelectedElf } from '../../services/elfAgent';
import { revokeLocalPath, selectLocalFile } from '../../services/localFiles';

vi.mock('../../services/elfAgent', () => ({ analyzeSelectedElf: vi.fn() }));
vi.mock('../../services/localFiles', () => ({ revokeLocalPath: vi.fn(), selectLocalFile: vi.fn() }));

describe('ElfTool real artifact workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(selectLocalFile).mockResolvedValue({ cancelled: false, kind: 'file', name: 'app.axf', path: 'D:\\build\\app.axf', selectionId: 'selection-1' });
    vi.mocked(revokeLocalPath).mockResolvedValue({ revoked: true });
    vi.mocked(analyzeSelectedElf).mockResolvedValue({ format: 'ELF', bits: 32, byteOrder: 'little', type: 'EXEC', machine: 'Arm', machineId: 40, entry: '0x8000101', fileSize: 4096, sections: [{ index: 1, name: '.text', type: 'PROGBITS', flags: '0x6', address: '0x8000000', offset: 256, size: 1024, entrySize: 0 }], segments: [{ index: 0, type: 'LOAD', flags: 5, offset: '0x100', virtualAddress: '0x8000000', physicalAddress: '0x8000000', fileSize: 1024, memorySize: 1024 }], symbolCount: 12, hasSymbols: true, dwarfSections: ['.debug_info'], hasDwarf: true, warnings: [] });
  });

  it('selects, analyzes, displays evidence, and revokes the file token', async () => {
    render(<ElfTool />);
    fireEvent.click(screen.getByRole('button', { name: '选择 ELF / AXF / OUT' }));

    await waitFor(() => expect(analyzeSelectedElf).toHaveBeenCalledWith('selection-1'));
    await waitFor(() => expect(revokeLocalPath).toHaveBeenCalledWith('selection-1'));
    expect(screen.getByText('Arm (40)')).toBeVisible();
    expect(screen.getByText('.text')).toBeVisible();
    expect(screen.getByText('具备基础条件')).toBeVisible();
    expect(screen.getByRole('button', { name: '导出 JSON' })).toBeEnabled();
  });

  it('keeps the workspace unchanged when selection is cancelled', async () => {
    vi.mocked(selectLocalFile).mockResolvedValue({ cancelled: true, kind: 'file' });
    render(<ElfTool />);
    fireEvent.click(screen.getByRole('button', { name: '选择 ELF / AXF / OUT' }));
    await waitFor(() => expect(selectLocalFile).toHaveBeenCalled());
    expect(analyzeSelectedElf).not.toHaveBeenCalled();
  });
});
