import type { FileNode } from '../types';

const DATABASE = 'embedkit-workspaces';
const STORE = 'workspaces';
const CURRENT_ID = 'current';

export interface StoredWorkspace {
  id: string;
  name: string;
  files: FileNode[];
  activeFile: string;
  updatedAt: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadCurrentWorkspace(): Promise<StoredWorkspace | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).get(CURRENT_ID);
    request.onsuccess = () => resolve((request.result as StoredWorkspace | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function saveCurrentWorkspace(workspace: Omit<StoredWorkspace, 'id' | 'updatedAt'>): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put({ ...workspace, id: CURRENT_ID, updatedAt: new Date().toISOString() } satisfies StoredWorkspace);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}
