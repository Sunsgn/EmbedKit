import { agentRequest } from './agentClient';

export interface LocalPathSelection { cancelled: boolean; kind: 'file' | 'directory'; path?: string; name?: string }

export function selectLocalPath(kind: 'file' | 'directory') {
  return agentRequest<LocalPathSelection>('/api/files/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind }),
  }, 5 * 60 * 1000);
}

export function selectLocalDirectory() { return selectLocalPath('directory'); }
export function selectLocalFile() { return selectLocalPath('file'); }
