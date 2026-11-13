import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteKnowledgeDocument, deleteKnowledgeDocumentDatabaseForTests, importKnowledgeDocument, knowledgeDocumentSnippet, listKnowledgeDocuments, searchKnowledgeDocuments } from './knowledgeDocumentLibrary';

afterEach(() => deleteKnowledgeDocumentDatabaseForTests());

describe('knowledge document library', () => {
  it('imports, persists, deduplicates, searches and deletes UTF-8 documents', async () => {
    const file = new File(['# CAN 故障诊断\n\n检查终端电阻和错误帧。'], 'can-debug.md', { type: 'text/markdown' });
    const first = await importKnowledgeDocument(file), duplicate = await importKnowledgeDocument(file);
    expect(first.duplicate).toBe(false);
    expect(duplicate).toMatchObject({ duplicate: true, record: { kind: 'markdown', fileName: 'can-debug.md' } });
    const records = await listKnowledgeDocuments();
    expect(records).toHaveLength(1);
    expect(searchKnowledgeDocuments(records, '终端 错误帧')).toHaveLength(1);
    expect(knowledgeDocumentSnippet(records[0], '终端')).toContain('终端电阻');
    await deleteKnowledgeDocument(first.record.id);
    expect(await listKnowledgeDocuments()).toEqual([]);
  });

  it('rejects unsupported, empty and invalid UTF-8 files with recoverable errors', async () => {
    await expect(importKnowledgeDocument(new File([], 'empty.txt'))).rejects.toThrow(/为空/);
    await expect(importKnowledgeDocument(new File(['legacy'], 'manual.doc'))).rejects.toThrow(/仅支持/);
    await expect(importKnowledgeDocument(new File([new Uint8Array([0xff, 0xfe, 0xfd])], 'bad.txt'))).rejects.toThrow(/UTF-8/);
  });
});
