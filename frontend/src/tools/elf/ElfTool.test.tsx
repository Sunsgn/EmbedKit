import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ElfTool from './ElfTool';
import { analyzeSelectedElf, lookupElfAddress } from '../../services/elfAgent';
import { revokeLocalPath, selectLocalFile } from '../../services/localFiles';

vi.mock('../../services/elfAgent', () => ({ analyzeSelectedElf: vi.fn(), lookupElfAddress: vi.fn() }));
vi.mock('../../services/localFiles', () => ({ revokeLocalPath: vi.fn(), selectLocalFile: vi.fn() }));

describe('ElfTool real artifact workflow', () => {
  const renderTool = (entry = '/toolbox/elf') => render(<MemoryRouter initialEntries={[entry]}><ElfTool /></MemoryRouter>);
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(selectLocalFile).mockResolvedValue({ cancelled: false, kind: 'file', name: 'app.axf', path: 'D:\\build\\app.axf', selectionId: 'selection-1' });
    vi.mocked(revokeLocalPath).mockResolvedValue({ revoked: true });
    vi.mocked(analyzeSelectedElf).mockResolvedValue({ analysisId: 'analysis-1', expiresAt: '2026-10-10T12:00:00.000Z', format: 'ELF', bits: 32, byteOrder: 'little', type: 'EXEC', machine: 'Arm', machineId: 40, entry: '0x8000101', fileSize: 4096, sections: [{ index: 1, name: '.text', type: 'PROGBITS', flags: '0x6', address: '0x8000000', offset: 256, size: 1024, entrySize: 0, link: 0 }], segments: [{ index: 0, type: 'LOAD', flags: 5, offset: '0x100', virtualAddress: '0x8000000', physicalAddress: '0x8000000', fileSize: 1024, memorySize: 1024 }], symbolCount: 12, namedSymbolCount: 8, hasSymbols: true, symbolPreview: [{ table: '.symtab', index: 1, name: 'main', address: '0x8000101', normalizedAddress: '0x8000100', size: 16, binding: 'GLOBAL', type: 'FUNC', visibility: 'DEFAULT', sectionIndex: 1, sectionName: '.text' }], dwarfSections: ['.debug_line'], hasDwarf: true, dwarfVersions: [4], dwarfLineUnits: 1, dwarfLineCount: 1, hasSourceLines: true, warnings: [] });
    vi.mocked(lookupElfAddress).mockResolvedValue({ requestedAddress: '0x8000101', normalizedAddress: '0x8000100', thumbBitCleared: true, match: 'exact-symbol', confidence: 'high', symbol: { table: '.symtab', index: 1, name: 'main', address: '0x8000101', normalizedAddress: '0x8000100', size: 16, binding: 'GLOBAL', type: 'FUNC', visibility: 'DEFAULT', sectionIndex: 1, sectionName: '.text', offset: '0x0' }, section: { index: 1, name: '.text', address: '0x8000000', size: 1024, offset: '0x100' }, source: { file: 'src/main.c', line: 42, column: 3, address: '0x8000100' }, note: '由 DWARF 行表定位到源码' });
  });

  it('selects, analyzes, displays evidence, and revokes the file token', async () => {
    renderTool();
    fireEvent.click(screen.getByRole('button', { name: '选择 ELF / AXF / OUT' }));

    await waitFor(() => expect(analyzeSelectedElf).toHaveBeenCalledWith('selection-1'));
    await waitFor(() => expect(revokeLocalPath).toHaveBeenCalledWith('selection-1'));
    expect(screen.getByText('Arm (40)')).toBeVisible();
    expect(screen.getAllByText('.text').length).toBeGreaterThan(0);
    expect(screen.getByText('1 条源码行')).toBeVisible();
    expect(screen.getByText('main')).toBeVisible();
    expect(screen.getByRole('button', { name: '导出 JSON' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '定位地址' }));
    await waitFor(() => expect(lookupElfAddress).toHaveBeenCalledWith('analysis-1', '0x8000101'));
    expect(screen.getByText('main + 0x0')).toBeVisible();
    expect(screen.getByText('0x8000100（已清除 Thumb 位）')).toBeVisible();
    expect(screen.getByText('src/main.c:42:3')).toBeVisible();
  });

  it('keeps the workspace unchanged when selection is cancelled', async () => {
    vi.mocked(selectLocalFile).mockResolvedValue({ cancelled: true, kind: 'file' });
    renderTool();
    fireEvent.click(screen.getByRole('button', { name: '选择 ELF / AXF / OUT' }));
    await waitFor(() => expect(selectLocalFile).toHaveBeenCalled());
    expect(analyzeSelectedElf).not.toHaveBeenCalled();
  });

  it('preserves a HardFault address passed through the independent tool route', async () => {
    renderTool('/toolbox/elf?address=0x0800ABCD&source=hardfault');
    fireEvent.click(screen.getByRole('button', { name: '选择 ELF / AXF / OUT' }));
    await waitFor(() => expect(analyzeSelectedElf).toHaveBeenCalled());
    expect(screen.getByPlaceholderText('例如 0x08000108')).toHaveValue('0x0800ABCD');
  });
});
