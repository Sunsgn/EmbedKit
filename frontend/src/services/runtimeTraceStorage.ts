import type { RuntimeTraceAnalysis } from '../utils/runtimeTrace';

const DATABASE = 'embedkit-runtime-traces';
const STORE = 'traces';

interface StoredTrace { id: string; events: RuntimeTraceAnalysis['events']; contexts: string[]; durationMs: number; warnings: string[]; updatedAt: string }

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadRuntimeTrace(projectId: string): Promise<RuntimeTraceAnalysis | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readonly'), request = transaction.objectStore(STORE).get(projectId);
    request.onsuccess = () => { const stored = request.result as StoredTrace | undefined; resolve(stored ? { events: stored.events, contexts: stored.contexts, durationMs: stored.durationMs, warnings: stored.warnings, executedNames: new Set(stored.events.map(item => item.name)) } : null); };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function saveRuntimeTrace(projectId: string, trace: RuntimeTraceAnalysis): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put({ id: projectId, events: trace.events, contexts: trace.contexts, durationMs: trace.durationMs, warnings: trace.warnings, updatedAt: new Date().toISOString() } satisfies StoredTrace);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearRuntimeTrace(projectId: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite'); transaction.objectStore(STORE).delete(projectId);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}
