import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OnlinePartLookup from './OnlinePartLookup';

afterEach(() => vi.unstubAllGlobals());
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', 'X-EmbedKit-Protocol': '1' } });

describe('OnlinePartLookup', () => {
  it('discovers an exact model and adds it as an unverified candidate', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ schemaVersion: 1, sources: [{ id: 'a' }, { id: 'b' }], limits: { queryLength: 120, automaticPdfDownload: false, parametricSearch: false } }))
      .mockResolvedValueOnce(response({ productName: 'TCAN1042', description: 'CAN FD transceiver', source: 'Test source', specs: { rate: '5 Mbps' }, productUrl: 'https://example.com/TCAN1042' }));
    vi.stubGlobal('fetch', fetchMock);
    const onAdd = vi.fn();
    render(<OnlinePartLookup onAdd={onAdd} />);
    expect(await screen.findByText(/2 个来源/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('在线查询器件型号'), { target: { value: 'TCAN1042' } });
    fireEvent.click(screen.getByRole('button', { name: '查询' }));
    expect(await screen.findByText('TCAN1042')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '加入本次候选' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ mpn: 'TCAN1042', category: '在线发现器件' })));
  });
});
