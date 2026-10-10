import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeLocalFileChunk, getLocalFileMetadata, readLocalFileBytes, readLocalFileChunk, revokeLocalPath, selectLocalDirectory, selectLocalFile } from './localFiles';

afterEach(() => vi.unstubAllGlobals());
const response = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'X-EmbedKit-Protocol': '1' } });

describe('controlled Local Agent path picker', () => {
  it('requests only the selection kind and preserves cancellation', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response({ cancelled: false, kind: 'directory', path: 'D:\\firmware', name: 'firmware' })).mockResolvedValueOnce(response({ cancelled: true, kind: 'file' }));
    vi.stubGlobal('fetch', fetch);

    await expect(selectLocalDirectory()).resolves.toMatchObject({ cancelled: false, path: 'D:\\firmware' });
    await expect(selectLocalFile()).resolves.toEqual({ cancelled: true, kind: 'file' });
    expect(fetch.mock.calls[0][1]).toEqual(expect.objectContaining({ method: 'POST', body: JSON.stringify({ kind: 'directory' }) }));
    expect(fetch.mock.calls[1][1]).toEqual(expect.objectContaining({ method: 'POST', body: JSON.stringify({ kind: 'file' }) }));
  });

  it('reads bounded chunks by selection token and revokes access', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response({ id: 'selection-1', kind: 'file', name: 'firmware.bin', size: 4, modifiedAt: '', expiresAt: '' }))
      .mockResolvedValueOnce(response({ selectionId: 'selection-1', offset: 0, byteLength: 4, size: 4, eof: true, encoding: 'base64', data: '3q2+7w==' }))
      .mockResolvedValueOnce(response({ revoked: true }));
    vi.stubGlobal('fetch', fetch);

    await expect(getLocalFileMetadata('selection-1')).resolves.toMatchObject({ size: 4 });
    const chunk = await readLocalFileChunk('selection-1', 0, 4);
    expect([...decodeLocalFileChunk(chunk)]).toEqual([0xde, 0xad, 0xbe, 0xef]);
    await expect(revokeLocalPath('selection-1')).resolves.toEqual({ revoked: true });
    expect(fetch.mock.calls.map(call => new URL(String(call[0])).pathname + new URL(String(call[0])).search)).toEqual([
      '/api/files/selections/selection-1',
      '/api/files/selections/selection-1/chunk?offset=0&length=4',
      '/api/files/selections/selection-1',
    ]);
  });

  it('assembles a bounded file while validating every chunk', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response({ id: 'selection-2', kind: 'file', name: 'app.bin', size: 5, modifiedAt: '', expiresAt: '' }))
      .mockResolvedValueOnce(response({ selectionId: 'selection-2', offset: 0, byteLength: 5, size: 5, eof: true, encoding: 'base64', data: 'AQIDBAU=' }));
    vi.stubGlobal('fetch', fetch); const progress = vi.fn();
    const result = await readLocalFileBytes('selection-2', 8, progress);
    expect([...result.bytes]).toEqual([1, 2, 3, 4, 5]); expect(progress).toHaveBeenLastCalledWith(100);
  });

  it('rejects oversized files before requesting a chunk', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response({ id: 'selection-3', kind: 'file', name: 'huge.bin', size: 9, modifiedAt: '', expiresAt: '' }));
    vi.stubGlobal('fetch', fetch);
    await expect(readLocalFileBytes('selection-3', 8)).rejects.toThrow(/超过/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
