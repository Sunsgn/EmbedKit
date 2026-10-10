import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MapTool from './MapTool';

const map = `Memory Configuration
FLASH 0x08000000 0x1000 xr
Linker script and memory map
.text 0x08000000 0x100
                0x08000000 0x10 main`;

describe('MAP address workflow', () => {
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
});
