import type { PartDocumentKind } from '../types';

const DATABASE = 'embedkit-part-documents';
const VERSION = 2;
const STORE = 'documents';
const CONTENT_STORE = 'document-content';
export const LOCAL_PART_DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;
export const LOCAL_PART_DOCUMENT_MAX_COUNT = 200;
export const LOCAL_PART_DOCUMENT_TOTAL_BYTES = 250 * 1024 * 1024;

export interface LocalPartDocumentRecord {
  schemaVersion: 1;
  id: string;
  model: string;
  modelKey: string;
  kind: PartDocumentKind;
  title: string;
  fileName: string;
  byteLength: number;
  sha256: string;
  sourceName: '用户本地文件';
  addedAt: string;
}

interface StoredDocumentContent { id: string; bytes: ArrayBuffer }

function normalizeModel(model: string) {
  const value = model.trim().slice(0, 160);
  if (value.length < 2) throw new Error('请先输入至少 2 个字符的完整器件型号');
  return { model: value, modelKey: value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '') };
}

function inferKind(fileName: string): PartDocumentKind {
  const value = fileName.toLowerCase().replace(/[_-]+/g, ' ');
  if (/errata/.test(value)) return 'errata';
  if (/reference|ref ?manual/.test(value)) return 'reference-manual';
  if (/user|guide|manual/.test(value)) return 'user-guide';
  if (/application|app ?note/.test(value)) return 'application-note';
  if (/hardware|layout|design/.test(value)) return 'hardware-design-guide';
  return 'datasheet';
}

async function digest(bytes: ArrayBuffer) {
  const value = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(value)].map(item => item.toString(16).padStart(2, '0')).join('');
}

function openDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) return Promise.reject(new Error('当前浏览器不支持 IndexedDB，无法持久保存本地资料'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = (event) => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        const store = request.result.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('modelKey', 'modelKey');
        store.createIndex('addedAt', 'addedAt');
      }
      if (!request.result.objectStoreNames.contains(CONTENT_STORE)) request.result.createObjectStore(CONTENT_STORE, { keyPath: 'id' });
      if ((event as IDBVersionChangeEvent).oldVersion === 1) {
        const records = request.transaction!.objectStore(STORE), contents = request.transaction!.objectStore(CONTENT_STORE), cursorRequest = records.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const legacy = cursor.value as LocalPartDocumentRecord & { bytes?: ArrayBuffer };
          if (legacy.bytes && typeof legacy.bytes.byteLength === 'number') {
            contents.put({ id: legacy.id, bytes: legacy.bytes } satisfies StoredDocumentContent);
            const { bytes: _bytes, ...record } = legacy;
            cursor.update(record);
          }
          cursor.continue();
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开本地资料库'));
  });
}

async function allStored(database: IDBDatabase): Promise<LocalPartDocumentRecord[]> {
  return await new Promise((resolve, reject) => {
    const request = database.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as LocalPartDocumentRecord[]);
    request.onerror = () => reject(request.error);
  });
}

export async function importLocalPartDocument(modelInput: string, file: File): Promise<LocalPartDocumentRecord> {
  const { model, modelKey } = normalizeModel(modelInput);
  if (!file || file.size < 5) throw new Error('请选择包含有效内容的 PDF 文件');
  if (file.size > LOCAL_PART_DOCUMENT_MAX_BYTES) throw new Error('PDF 超过 50 MiB 上限');
  const bytes = await file.arrayBuffer();
  if (new TextDecoder('ascii').decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('文件头不是有效 PDF');
  const sha256 = await digest(bytes), id = `local:${modelKey}:${sha256}`;
  const database = await openDatabase();
  try {
    const existing = await allStored(database), duplicate = existing.find(item => item.id === id);
    if (duplicate) return duplicate;
    if (existing.length >= LOCAL_PART_DOCUMENT_MAX_COUNT) throw new Error(`本地资料已达到 ${LOCAL_PART_DOCUMENT_MAX_COUNT} 份上限，请先删除旧资料`);
    if (existing.reduce((sum, item) => sum + item.byteLength, 0) + bytes.byteLength > LOCAL_PART_DOCUMENT_TOTAL_BYTES) throw new Error('本地资料总量将超过 250 MiB，请先删除旧资料');
    const value: LocalPartDocumentRecord = { schemaVersion: 1, id, model, modelKey, kind: inferKind(file.name), title: file.name.replace(/\.pdf$/i, '') || '本地规格书', fileName: file.name.slice(0, 240), byteLength: bytes.byteLength, sha256, sourceName: '用户本地文件', addedAt: new Date().toISOString() };
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([STORE, CONTENT_STORE], 'readwrite');
      transaction.objectStore(STORE).put(value);
      transaction.objectStore(CONTENT_STORE).put({ id, bytes } satisfies StoredDocumentContent);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('本地资料保存已中止'));
    });
    return value;
  } finally { database.close(); }
}

export async function listLocalPartDocuments(modelInput: string): Promise<LocalPartDocumentRecord[]> {
  const { modelKey } = normalizeModel(modelInput), database = await openDatabase();
  try {
    const values = await new Promise<LocalPartDocumentRecord[]>((resolve, reject) => {
      const request = database.transaction(STORE, 'readonly').objectStore(STORE).index('modelKey').getAll(modelKey);
      request.onsuccess = () => resolve(request.result as LocalPartDocumentRecord[]);
      request.onerror = () => reject(request.error);
    });
    return values.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  } finally { database.close(); }
}

export async function readLocalPartDocument(id: string): Promise<{ record: LocalPartDocumentRecord; bytes: Uint8Array }> {
  if (!id.startsWith('local:') || id.length > 180) throw new Error('本地资料标识无效');
  const database = await openDatabase();
  try {
    const value = await new Promise<{ record?: LocalPartDocumentRecord; content?: StoredDocumentContent }>((resolve, reject) => {
      const transaction = database.transaction([STORE, CONTENT_STORE], 'readonly'), recordRequest = transaction.objectStore(STORE).get(id), contentRequest = transaction.objectStore(CONTENT_STORE).get(id);
      transaction.oncomplete = () => resolve({ record: recordRequest.result as LocalPartDocumentRecord | undefined, content: contentRequest.result as StoredDocumentContent | undefined });
      transaction.onerror = () => reject(transaction.error);
    });
    if (!value.record || !value.content) throw new Error('本地 PDF 已被删除或浏览器站点数据已清理');
    const bytes = new Uint8Array(value.content.bytes);
    if (bytes.byteLength !== value.record.byteLength || new TextDecoder('ascii').decode(bytes.subarray(0, 5)) !== '%PDF-' || await digest(value.content.bytes) !== value.record.sha256) throw new Error('本地 PDF 完整性校验失败，请删除后重新导入');
    return { record: value.record, bytes };
  } finally { database.close(); }
}

export async function deleteLocalPartDocument(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([STORE, CONTENT_STORE], 'readwrite');
      transaction.objectStore(STORE).delete(id);
      transaction.objectStore(CONTENT_STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { database.close(); }
}

export function deleteLocalPartDocumentDatabaseForTests() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('本地资料测试数据库仍被占用'));
  });
}
