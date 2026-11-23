export type BrowserDownloadErrorCode = 'create_failed' | 'trigger_failed' | 'cleanup_failed';

export class BrowserDownloadError extends Error {
  readonly code: BrowserDownloadErrorCode;

  constructor(code: BrowserDownloadErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'BrowserDownloadError';
    this.code = code;
  }
}

interface DownloadAnchor {
  href: string;
  download: string;
  click: () => void;
}

interface BrowserDownloadDependencies {
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
  createAnchor: () => DownloadAnchor;
}

const defaultDependencies: BrowserDownloadDependencies = {
  createObjectUrl: blob => URL.createObjectURL(blob),
  revokeObjectUrl: url => URL.revokeObjectURL(url),
  createAnchor: () => document.createElement('a'),
};

export function safeDownloadFileName(value: string, fallback = 'download') {
  const leaf = value.replace(/\\/g, '/').split('/').pop() ?? '';
  const portable = [...leaf].map(character => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 || '<>:"/\\|?*'.includes(character) ? '-' : character;
  }).join('');
  const cleaned = portable
    .replace(/-+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s-]+|[.\s]+$/g, '')
    .slice(0, 180);
  return cleaned || fallback;
}

export function downloadBrowserBlob(blob: Blob, fileName: string, overrides: Partial<BrowserDownloadDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const safeName = safeDownloadFileName(fileName);
  let objectUrl: string;
  try {
    objectUrl = dependencies.createObjectUrl(blob);
  } catch (reason) {
    throw new BrowserDownloadError('create_failed', '浏览器无法创建下载资源', { cause: reason });
  }

  let triggerFailure: unknown;
  try {
    const anchor = dependencies.createAnchor();
    anchor.href = objectUrl;
    anchor.download = safeName;
    anchor.click();
  } catch (reason) {
    triggerFailure = reason;
  }
  let cleanupFailure: unknown;
  try { dependencies.revokeObjectUrl(objectUrl); } catch (reason) { cleanupFailure = reason; }
  if (triggerFailure) throw new BrowserDownloadError('trigger_failed', '浏览器未能启动文件下载', { cause: triggerFailure });
  if (cleanupFailure) throw new BrowserDownloadError('cleanup_failed', '文件已触发下载，但临时资源释放失败', { cause: cleanupFailure });
  return { fileName: safeName };
}

export function downloadBrowserText(content: string, fileName: string, type = 'text/plain;charset=utf-8', overrides: Partial<BrowserDownloadDependencies> = {}) {
  return downloadBrowserBlob(new Blob([content], { type }), fileName, overrides);
}
