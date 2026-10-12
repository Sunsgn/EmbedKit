import type { DeviceProject, TestRunRecord } from '../types/product';
import { normalizeTestRunRecord } from './testRunEvidence';

const DATABASE = 'embedkit-product';
const VERSION = 1;
const PROJECTS = 'projects';
const RUNS = 'test-runs';
const SETTINGS = 'settings';
const PORTABLE_SETTINGS = new Set(['activeProjectId', 'activeDeviceId']);

export interface ProductDataSnapshot {
  projects: DeviceProject[];
  runs: TestRunRecord[];
  settings: Array<{ key: string; value: unknown }>;
}

export function createPortableProductData(snapshot: ProductDataSnapshot): ProductDataSnapshot {
  return {
    projects: snapshot.projects.slice(0, 500),
    runs: snapshot.runs.map(normalizeTestRunRecord).map(run => ({
      ...run,
      environment: Object.fromEntries(Object.entries(run.environment).filter(([key]) => !/(?:password|api.?key|token|credential)/i.test(key))),
      steps: run.steps.map(({ error: _error, evidence, ...step }) => ({
        ...step,
        ...(evidence ? { evidence: { source: evidence.source, ...(evidence.timeoutMs === undefined ? {} : { timeoutMs: evidence.timeoutMs }) } } : {}),
      })),
      logs: [],
    })).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 5000),
    settings: snapshot.settings.filter(item => PORTABLE_SETTINGS.has(item.key)),
  };
}

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
export async function listTestRuns() { return (await readAll<TestRunRecord>(RUNS)).map(normalizeTestRunRecord).sort((a, b) => b.startedAt.localeCompare(a.startedAt)); }
export async function saveTestRun(run: TestRunRecord) { await put(RUNS, run); }
export async function deleteTestRun(id: string) { await remove(RUNS, id); }
export async function setProductSetting<T>(key: string, value: T) { await put(SETTINGS, { key, value }); }
export async function getProductSetting<T>(key: string): Promise<T | null> { const database = await openDatabase(); return await new Promise((resolve, reject) => { const transaction = database.transaction(SETTINGS, 'readonly'), request = transaction.objectStore(SETTINGS).get(key); request.onsuccess = () => resolve((request.result as { value?: T } | undefined)?.value ?? null); request.onerror = () => reject(request.error); transaction.oncomplete = () => database.close(); }); }

export async function exportProductData(): Promise<ProductDataSnapshot> {
  const [projects, runs, settings] = await Promise.all([
    readAll<DeviceProject>(PROJECTS),
    readAll<TestRunRecord>(RUNS),
    readAll<{ key: string; value: unknown }>(SETTINGS),
  ]);
  return createPortableProductData({ projects, runs, settings });
}

export async function mergeProductData(snapshot: ProductDataSnapshot): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([PROJECTS, RUNS, SETTINGS], 'readwrite');
    const projects = transaction.objectStore(PROJECTS), runs = transaction.objectStore(RUNS), settings = transaction.objectStore(SETTINGS);
    snapshot.projects.forEach(project => projects.put(project));
    snapshot.runs.forEach(run => runs.put(normalizeTestRunRecord(run)));
    snapshot.settings.filter(item => PORTABLE_SETTINGS.has(item.key)).forEach(item => settings.put(item));
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('工作区数据导入已中止')); };
  });
}
