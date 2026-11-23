import { describe, expect, it, vi } from 'vitest';
import { BrowserDownloadError, downloadBrowserText, safeDownloadFileName } from './browserDownload';

describe('browser download service', () => {
  it.each([
    ['../reports/project:demo?.md', 'project-demo-.md'],
    ['  嵌入式   报告.md  ', '嵌入式 报告.md'],
    ['..', 'download'],
  ])('sanitizes portable filename %s', (input, expected) => {
    expect(safeDownloadFileName(input)).toBe(expected);
  });

  it('downloads text with the requested MIME type and always releases the object URL', async () => {
    let exported: Blob | null = null;
    const anchor = { href: '', download: '', click: vi.fn() };
    const revokeObjectUrl = vi.fn();
    const result = downloadBrowserText('evidence', '../report.md', 'text/markdown;charset=utf-8', {
      createObjectUrl: blob => { exported = blob; return 'blob:test'; }, createAnchor: () => anchor, revokeObjectUrl,
    });
    expect(result).toEqual({ fileName: 'report.md' });
    expect(anchor).toMatchObject({ href: 'blob:test', download: 'report.md' });
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:test');
    expect(exported).not.toBeNull();
    const exportedBlob = exported as unknown as Blob;
    expect(exportedBlob.type).toBe('text/markdown;charset=utf-8');
    expect(await exportedBlob.text()).toBe('evidence');
  });

  it('classifies object URL creation failures', () => {
    expect(() => downloadBrowserText('x', 'x.txt', undefined, { createObjectUrl: () => { throw new Error('blocked'); } }))
      .toThrow(expect.objectContaining({ code: 'create_failed' }));
  });

  it('releases the object URL when the browser rejects the click', () => {
    const revokeObjectUrl = vi.fn();
    try {
      downloadBrowserText('x', 'x.txt', undefined, {
        createObjectUrl: () => 'blob:test', createAnchor: () => ({ href: '', download: '', click: () => { throw new Error('denied'); } }), revokeObjectUrl,
      });
      throw new Error('expected download failure');
    } catch (reason) {
      expect(reason).toBeInstanceOf(BrowserDownloadError);
      expect(reason).toMatchObject({ code: 'trigger_failed' });
    }
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:test');
  });

  it('reports cleanup failures after a successful download trigger', () => {
    expect(() => downloadBrowserText('x', 'x.txt', undefined, {
      createObjectUrl: () => 'blob:test', createAnchor: () => ({ href: '', download: '', click: vi.fn() }), revokeObjectUrl: () => { throw new Error('cleanup denied'); },
    })).toThrow(expect.objectContaining({ code: 'cleanup_failed' }));
  });
});
