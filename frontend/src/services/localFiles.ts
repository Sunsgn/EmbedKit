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
