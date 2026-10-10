import { agentRequest } from './agentClient';

export interface LocalPathSelection { cancelled: boolean; kind: 'file' | 'directory'; path?: string; name?: string; selectionId?: string; size?: number; modifiedAt?: string; expiresAt?: string }
export interface LocalFileMetadata { id: string; kind: 'file'; name: string; size: number; modifiedAt: string; expiresAt: string }
export interface LocalFileChunk { selectionId: string; offset: number; byteLength: number; size: number; eof: boolean; encoding: 'base64'; data: string }

export function selectLocalPath(kind: 'file' | 'directory') {
  return agentRequest<LocalPathSelection>('/api/files/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind }),
  }, 5 * 60 * 1000);
}

export function selectLocalDirectory() { return selectLocalPath('directory'); }
export function selectLocalFile() { return selectLocalPath('file'); }
export function getLocalFileMetadata(selectionId: string) { return agentRequest<LocalFileMetadata>(`/api/files/selections/${selectionId}`); }
export function readLocalFileChunk(selectionId: string, offset: number, length = 256 * 1024) { return agentRequest<LocalFileChunk>(`/api/files/selections/${selectionId}/chunk?offset=${offset}&length=${length}`); }
export function revokeLocalPath(selectionId: string) { return agentRequest<{ revoked: boolean }>(`/api/files/selections/${selectionId}`, { method: 'DELETE' }); }
export function decodeLocalFileChunk(chunk: LocalFileChunk) { const binary = window.atob(chunk.data), bytes = new Uint8Array(binary.length); for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index); return bytes; }

export async function readLocalFileBytes(selectionId: string, maxBytes: number, onProgress?: (percent: number) => void) {
  const metadata = await getLocalFileMetadata(selectionId);
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error('文件读取上限无效');
  if (metadata.size > maxBytes) throw new Error(`文件大小 ${metadata.size} B 超过 ${maxBytes} B 上限`);
  const bytes = new Uint8Array(metadata.size); let offset = 0;
  while (offset < metadata.size) {
    const chunk = await readLocalFileChunk(selectionId, offset, Math.min(256 * 1024, metadata.size - offset));
    const decoded = decodeLocalFileChunk(chunk);
    if (chunk.size !== metadata.size || chunk.offset !== offset || chunk.byteLength <= 0 || chunk.byteLength !== decoded.length || offset + decoded.length > bytes.length) throw new Error('文件分块读取结果不一致');
    bytes.set(decoded, offset); offset += decoded.length; onProgress?.(Math.round(offset / metadata.size * 100));
    if (chunk.eof) break;
  }
  if (offset !== metadata.size) throw new Error('文件未完整读取');
  if (metadata.size === 0) onProgress?.(100);
  return { metadata, bytes };
}
