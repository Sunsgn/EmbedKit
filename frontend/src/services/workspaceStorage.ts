import type { FileNode } from '../types';

const DATABASE = 'embedkit-workspaces';
const STORE = 'workspaces';
const CURRENT_ID = 'current';
const PROJECT_PREFIX = 'project:';
export const PROJECT_WORKSPACE_SCHEMA_VERSION = 1 as const;
export const PROJECT_WORKSPACE_MAX_FILES = 5000;
export const PROJECT_WORKSPACE_MAX_BYTES = 50 * 1024 * 1024;

export interface StoredWorkspace {
  id: string;
  name: string;
  files: FileNode[];
  activeFile: string;
  updatedAt: string;
}

export interface ProjectWorkspace extends StoredWorkspace {
  schemaVersion: typeof PROJECT_WORKSPACE_SCHEMA_VERSION;
  projectId: string;
  revisionId: string;
  importedAt: string;
  sourceFingerprint: string;
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

const validProjectId = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value);
const workspaceId = (projectId: string) => {
  if (!validProjectId(projectId)) throw new Error('工程 ID 无效');
  return `${PROJECT_PREFIX}${projectId}`;
};

function validateFiles(files: FileNode[]) {
  if (!Array.isArray(files) || files.length > PROJECT_WORKSPACE_MAX_FILES) throw new Error(`工程工作区最多保存 ${PROJECT_WORKSPACE_MAX_FILES} 个文件`);
  const encoder = new TextEncoder(); let bytes = 0;
  for (const file of files) {
    if (!file || typeof file.path !== 'string' || !file.path.startsWith('/') || typeof file.name !== 'string' || typeof file.content !== 'string') throw new Error('工程工作区包含无效文件');
    bytes += encoder.encode(file.path).byteLength + encoder.encode(file.content).byteLength;
    if (bytes > PROJECT_WORKSPACE_MAX_BYTES) throw new Error('工程工作区内容超过 50 MiB 上限');
  }
}

async function readWorkspace(id: string): Promise<StoredWorkspace | ProjectWorkspace | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).get(id);
    request.onsuccess = () => resolve((request.result as StoredWorkspace | ProjectWorkspace | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function writeWorkspace(workspace: StoredWorkspace | ProjectWorkspace): Promise<void> {
  validateFiles(workspace.files);
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(workspace);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function createWorkspaceFingerprint(files: FileNode[]): Promise<string> {
  validateFiles(files);
  const encoder = new TextEncoder(), ordered = [...files].sort((left, right) => left.path.localeCompare(right.path));
  const chunks = ordered.flatMap(file => [encoder.encode(file.path), Uint8Array.of(0), encoder.encode(file.content), Uint8Array.of(0)]);
  const total = chunks.reduce((size, chunk) => size + chunk.byteLength, 0), bytes = new Uint8Array(total);
  let offset = 0;
  chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.byteLength; });
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer);
  return [...new Uint8Array(digest)].map(item => item.toString(16).padStart(2, '0')).join('');
}

export async function createProjectRevisionId(projectId: string, sourceFingerprint: string): Promise<string> {
  workspaceId(projectId);
  if (!/^[0-9a-f]{64}$/.test(sourceFingerprint)) throw new Error('源码指纹无效');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${projectId}\0${sourceFingerprint}`));
  const identity = [...new Uint8Array(digest)].map(item => item.toString(16).padStart(2, '0')).join('');
  return `revision:${identity}`;
}

export async function loadCurrentWorkspace(): Promise<StoredWorkspace | null> {
  const value = await readWorkspace(CURRENT_ID);
  return value && !('projectId' in value) ? value : null;
}

export async function saveCurrentWorkspace(workspace: Omit<StoredWorkspace, 'id' | 'updatedAt'>): Promise<void> {
  await writeWorkspace({ ...workspace, id: CURRENT_ID, updatedAt: new Date().toISOString() });
}

export async function loadProjectWorkspace(projectId: string): Promise<ProjectWorkspace | null> {
  const value = await readWorkspace(workspaceId(projectId));
  if (!value || !('projectId' in value) || value.schemaVersion !== PROJECT_WORKSPACE_SCHEMA_VERSION || value.projectId !== projectId || !/^[0-9a-f]{64}$/.test(value.sourceFingerprint)) return null;
  validateFiles(value.files);
  return value;
}

export async function saveProjectWorkspace(workspace: Omit<ProjectWorkspace, 'id' | 'updatedAt'>): Promise<void> {
  if (!workspace.revisionId || !/^[0-9a-f]{64}$/.test(workspace.sourceFingerprint)) throw new Error('工程工作区缺少有效源码修订');
  await writeWorkspace({ ...workspace, id: workspaceId(workspace.projectId), updatedAt: new Date().toISOString() });
}

export async function copyLegacyWorkspaceToProject(projectId: string, projectName: string): Promise<ProjectWorkspace | null> {
  const legacy = await loadCurrentWorkspace();
  if (!legacy?.files.length) return null;
  const sourceFingerprint = await createWorkspaceFingerprint(legacy.files), importedAt = new Date().toISOString();
  const revisionId = await createProjectRevisionId(projectId, sourceFingerprint);
  const workspace: Omit<ProjectWorkspace, 'id' | 'updatedAt'> = { schemaVersion: PROJECT_WORKSPACE_SCHEMA_VERSION, projectId, revisionId, name: projectName, files: legacy.files, activeFile: legacy.files.some(file => file.path === legacy.activeFile) ? legacy.activeFile : legacy.files[0].path, importedAt, sourceFingerprint };
  await saveProjectWorkspace(workspace);
  return { ...workspace, id: workspaceId(projectId), updatedAt: importedAt };
}
