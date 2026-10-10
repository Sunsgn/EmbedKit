import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectLocalDirectory, selectLocalFile } from './localFiles';

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
});
