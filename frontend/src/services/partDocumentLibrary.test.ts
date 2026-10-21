import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteLocalPartDocument, deleteLocalPartDocumentDatabaseForTests, importLocalPartDocument, listLocalPartDocuments, readLocalPartDocument } from './partDocumentLibrary';

const pdf = (name = 'TCAN1042-datasheet.pdf') => new File([new TextEncoder().encode('%PDF-1.4\nfixture')], name, { type: 'application/pdf' });

afterEach(() => deleteLocalPartDocumentDatabaseForTests());

describe('local part document library', () => {
  it('persists, deduplicates, verifies and deletes a PDF by normalized model', async () => {
    const first = await importLocalPartDocument('TCAN-1042', pdf());
    const duplicate = await importLocalPartDocument('TCAN-1042', pdf());
    expect(duplicate.id).toBe(first.id);
    expect(await listLocalPartDocuments('tcan 1042')).toHaveLength(1);
    const loaded = await readLocalPartDocument(first.id);
    expect(new TextDecoder().decode(loaded.bytes)).toContain('%PDF-1.4');
    expect(loaded.record).toMatchObject({ schemaVersion: 1, kind: 'datasheet', sourceName: '用户本地文件' });
    await deleteLocalPartDocument(first.id);
    expect(await listLocalPartDocuments('TCAN-1042')).toEqual([]);
  });

  it('rejects invalid and oversized input with an explicit boundary', async () => {
    await expect(importLocalPartDocument('A', pdf())).rejects.toThrow(/至少 2 个字符/);
    await expect(importLocalPartDocument('PART100', new File(['not pdf'], 'bad.pdf'))).rejects.toThrow(/文件头不是有效 PDF/);
  });

  it('migrates the initial single-store format without losing PDF content', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.4\nlegacy').buffer, sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(item => item.toString(16).padStart(2, '0')).join(''), id = `local:legacy100:${sha256}`;
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('embedkit-part-documents', 1);
      request.onupgradeneeded = () => { const store = request.result.createObjectStore('documents', { keyPath: 'id' }); store.createIndex('modelKey', 'modelKey'); store.createIndex('addedAt', 'addedAt'); store.put({ schemaVersion: 1, id, model: 'LEGACY100', modelKey: 'legacy100', kind: 'datasheet', title: 'Legacy', fileName: 'legacy.pdf', byteLength: bytes.byteLength, sha256, sourceName: '用户本地文件', addedAt: '2026-01-01T00:00:00.000Z', bytes }); };
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    });
    expect(await listLocalPartDocuments('LEGACY100')).toHaveLength(1);
    expect(new TextDecoder().decode((await readLocalPartDocument(id)).bytes)).toContain('legacy');
  });
});
