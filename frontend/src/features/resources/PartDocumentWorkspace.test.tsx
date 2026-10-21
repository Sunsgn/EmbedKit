import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { strToU8 } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PartDocumentWorkspace from './PartDocumentWorkspace';

const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('../../services/partSources', async importOriginal => ({ ...(await importOriginal<typeof import('../../services/partSources')>()), readOfficialPartDocument: mocks.read }));

function minimalPdf(text = '1 Features Low current') {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`, objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let output = '%PDF-1.4\n', offset = new TextEncoder().encode(output).length; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(offset); const value = `${index + 1} 0 obj\n${object}\nendobj\n`; output += value; offset += new TextEncoder().encode(value).length; });
  const xref = offset; output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return strToU8(output);
}

const document = { id: 'part:datasheet', kind: 'datasheet' as const, title: '数据手册', description: '官方数据手册', url: 'https://www.ti.com/lit/gpn/PART100', sourceName: 'Texas Instruments', access: 'official-pdf' as const, authoritative: true, scope: 'exact-model' as const };

describe('PartDocumentWorkspace', () => {
  beforeEach(() => mocks.read.mockReset());
  afterEach(() => cleanup());

  it('loads, extracts and navigates an official PDF with evidence', async () => {
    await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    const bytes = minimalPdf(); mocks.read.mockResolvedValue({ bytes, contentType: 'application/pdf', disposition: '', sourceUrl: document.url });
    render(<PartDocumentWorkspace model="PART100" document={document} onClose={() => undefined} />);
    expect(await screen.findByText('确定性解析结果', undefined, { timeout: 20_000 })).toBeInTheDocument();
    expect(screen.getByText('章节覆盖 9%')).toBeInTheDocument();
    expect(screen.getByTitle('PART100 官方 PDF 第 1 页')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '搜索数据手册全文' }), { target: { value: 'current' } });
    expect(screen.getByText('1 个匹配')).toBeInTheDocument();
    expect(screen.getByText(/第 1 页文本证据/)).toBeInTheDocument();
  }, 30_000);

  it('shows a recoverable parsing failure and keeps the official source available', async () => {
    mocks.read.mockResolvedValue({ bytes: strToU8('%PDF-invalid'), contentType: 'application/pdf', disposition: '', sourceUrl: document.url });
    render(<PartDocumentWorkspace model="PART100" document={document} onClose={() => undefined} />);
    expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement();
    expect(screen.getByRole('link', { name: /官方原址/ })).toHaveAttribute('href', document.url);
    expect(screen.getByRole('button', { name: /重新读取/ })).toBeInTheDocument();
  });
});
