import type { DeviceProject, TestRunRecord } from '../types/product';

const DATABASE = 'embedkit-product';
const VERSION = 1;
const PROJECTS = 'projects';
const RUNS = 'test-runs';
const SETTINGS = 'settings';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECTS)) database.createObjectStore(PROJECTS, { keyPath: 'id' });
      if (!database.objectStoreNames.contains(RUNS)) { const store = database.createObjectStore(RUNS, { keyPath: 'id' }); store.createIndex('startedAt', 'startedAt'); store.createIndex('projectId', 'projectId'); }
      if (!database.objectStoreNames.contains(SETTINGS)) database.createObjectStore(SETTINGS, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readAll<T>(storeName: string): Promise<T[]> {
  const database = await openDatabase();
  return await new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function put<T>(storeName: string, value: T): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

async function remove(storeName: string, key: IDBValidKey): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function listDeviceProjects() { return (await readAll<DeviceProject>(PROJECTS)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
export async function saveDeviceProject(project: DeviceProject) { await put(PROJECTS, { ...project, updatedAt: new Date().toISOString() }); }
export async function deleteDeviceProject(id: string) { await remove(PROJECTS, id); }
export async function listTestRuns() { return (await readAll<TestRunRecord>(RUNS)).sort((a, b) => b.startedAt.localeCompare(a.startedAt)); }
export async function saveTestRun(run: TestRunRecord) { await put(RUNS, run); }
export async function deleteTestRun(id: string) { await remove(RUNS, id); }
export async function setProductSetting<T>(key: string, value: T) { await put(SETTINGS, { key, value }); }
export async function getProductSetting<T>(key: string): Promise<T | null> { const database = await openDatabase(); return await new Promise((resolve, reject) => { const transaction = database.transaction(SETTINGS, 'readonly'), request = transaction.objectStore(SETTINGS).get(key); request.onsuccess = () => resolve((request.result as { value?: T } | undefined)?.value ?? null); request.onerror = () => reject(request.error); transaction.oncomplete = () => database.close(); }); }
