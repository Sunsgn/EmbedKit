import { DOCUMENT_FILE_MAX_BYTES, DOCUMENT_TEXT_MAX_BYTES, extractProtocolDocumentFile } from '../tools/frame/documentExtraction';

const DATABASE = 'embedkit-knowledge-documents';
const VERSION = 1;
const STORE = 'documents';
export const KNOWLEDGE_DOCUMENT_MAX_COUNT = 100;
export const KNOWLEDGE_DOCUMENT_TOTAL_TEXT_BYTES = 16 * 1024 * 1024;
export const KNOWLEDGE_DOCUMENT_BATCH_LIMIT = 20;

export type KnowledgeDocumentKind = 'markdown' | 'text' | 'pdf' | 'docx' | 'xlsx';

export interface KnowledgeDocumentRecord {
  schemaVersion: 1;
  id: string;
  title: string;
  fileName: string;
  kind: KnowledgeDocumentKind;
  fileBytes: number;
  textBytes: number;
  sha256: string;
  content: string;
  units: number;
  unitLabel: string;
  warnings: string[];
  addedAt: string;
}

const encoder = new TextEncoder();
const textBytes = (value: string) => encoder.encode(value).byteLength;
const extensionOf = (fileName: string) => fileName.toLocaleLowerCase().split('.').pop() ?? '';
const supportedText = new Set(['md', 'markdown', 'txt', 'csv', 'tsv', 'json']);

async function digest(bytes: ArrayBuffer) {
  const value = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(value)].map(item => item.toString(16).padStart(2, '0')).join('');
}

function openDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) return Promise.reject(new Error('当前浏览器不支持 IndexedDB，无法持久保存导入文档'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        const store = request.result.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('addedAt', 'addedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开导入文档库'));
  });
}

async function allStored(database: IDBDatabase) {
  return await new Promise<KnowledgeDocumentRecord[]>((resolve, reject) => {
    const request = database.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as KnowledgeDocumentRecord[]);
    request.onerror = () => reject(request.error);
  });
}

function assertFile(file: File) {
  if (!file || file.size === 0) throw new Error('文档为空，请选择包含实际内容的文件');
  if (file.size > DOCUMENT_FILE_MAX_BYTES) throw new Error('文档超过 50 MiB 文件上限，请拆分后导入');
  const extension = extensionOf(file.name);
  if (!supportedText.has(extension) && !['pdf', 'docx', 'xlsx'].includes(extension)) throw new Error('仅支持 Markdown、TXT、CSV、TSV、JSON、PDF、DOCX 和 XLSX；旧版 DOC/XLS 请先转换');
  return extension;
}

async function extractTextFile(file: File, extension: string) {
  if (file.size > DOCUMENT_TEXT_MAX_BYTES) throw new Error('文本或 Markdown 文件超过 2 MiB 上限，请拆分后导入');
  let content: string;
  try { content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()).replace(/^\uFEFF/, '').trim(); }
  catch { throw new Error('文本文件不是有效 UTF-8，请转换编码后重试'); }
  if (!content) throw new Error('文档没有可检索文本');
  return { content, kind: extension === 'md' || extension === 'markdown' ? 'markdown' as const : 'text' as const, units: content.split(/\r?\n/).length, unitLabel: '行', warnings: [] as string[] };
}

export async function importKnowledgeDocument(file: File, progress?: (message: string) => void, signal?: AbortSignal) {
  const extension = assertFile(file);
  if (signal?.aborted) throw new Error('文档导入已取消');
  progress?.(`正在读取 ${file.name}`);
  const extracted = supportedText.has(extension)
    ? await extractTextFile(file, extension)
    : await extractProtocolDocumentFile(file, progress, signal).then(result => ({ content: result.text.trim(), kind: result.kind, units: result.units, unitLabel: result.unitLabel, warnings: result.warnings }));
  if (!extracted.content) throw new Error('文档没有可检索文本；扫描 PDF 请先执行 OCR');
  const size = textBytes(extracted.content);
  if (size > DOCUMENT_TEXT_MAX_BYTES) throw new Error('提取文本超过 2 MiB 上限，请拆分后导入');
  const bytes = await file.arrayBuffer();
  if (signal?.aborted) throw new Error('文档导入已取消');
  const sha256 = await digest(bytes), id = `knowledge:${sha256}`;
  const database = await openDatabase();
  try {
    const existing = await allStored(database), duplicate = existing.find(item => item.id === id);
    if (duplicate) return { record: duplicate, duplicate: true };
    if (existing.length >= KNOWLEDGE_DOCUMENT_MAX_COUNT) throw new Error(`导入文档已达到 ${KNOWLEDGE_DOCUMENT_MAX_COUNT} 份上限，请先导出并删除旧文档`);
    if (existing.reduce((total, item) => total + item.textBytes, 0) + size > KNOWLEDGE_DOCUMENT_TOTAL_TEXT_BYTES) throw new Error('导入文档文本总量将超过 16 MiB，请先导出并删除旧文档');
    const title = file.name.replace(/\.[^.]+$/, '').trim().slice(0, 200) || '未命名文档';
    const record: KnowledgeDocumentRecord = { schemaVersion: 1, id, title, fileName: file.name.slice(0, 240), kind: extracted.kind, fileBytes: file.size, textBytes: size, sha256, content: extracted.content, units: extracted.units, unitLabel: extracted.unitLabel, warnings: extracted.warnings.slice(0, 100), addedAt: new Date().toISOString() };
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('文档保存已中止'));
    });
    return { record, duplicate: false };
  } finally { database.close(); }
}

export async function listKnowledgeDocuments() {
  const database = await openDatabase();
  try { return (await allStored(database)).sort((a, b) => b.addedAt.localeCompare(a.addedAt)); }
  finally { database.close(); }
}

export async function deleteKnowledgeDocument(id: string) {
  if (!id.startsWith('knowledge:')) throw new Error('导入文档标识无效');
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { database.close(); }
}

export function searchKnowledgeDocuments(records: KnowledgeDocumentRecord[], query: string) {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return records.filter(record => tokens.every(token => `${record.title} ${record.fileName} ${record.content}`.toLocaleLowerCase().includes(token)));
}

export function knowledgeDocumentSnippet(record: KnowledgeDocumentRecord, query: string) {
  const normalized = record.content.replace(/\s+/g, ' ').trim(), token = query.trim().split(/\s+/).find(Boolean)?.toLocaleLowerCase();
  if (!token) return normalized.slice(0, 140);
  const at = normalized.toLocaleLowerCase().indexOf(token), start = Math.max(0, at - 50);
  return `${start ? '…' : ''}${normalized.slice(start, start + 180)}${start + 180 < normalized.length ? '…' : ''}`;
}

export function deleteKnowledgeDocumentDatabaseForTests() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('导入文档测试数据库仍被占用'));
  });
}
