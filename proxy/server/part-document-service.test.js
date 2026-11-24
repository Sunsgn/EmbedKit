import assert from 'node:assert/strict';
import test from 'node:test';
import { createPartDocumentService } from './part-document-service.js';

const adapter = {
  name: 'Example Semiconductor',
  aliases: ['example'],
  domains: ['example.com'],
  pages: model => [`https://docs.example.com/parts/${model}`],
};

test('part document service supports injected vendor adapters and bounded caching', async () => {
  const service = createPartDocumentService({ adapters: [adapter], cacheTtlMs: 60_000 });
  let fetchCount = 0;
  service.configureFetcher(async url => {
    fetchCount += 1;
    return {
      finalUrl: url,
      html: '<a href="/pdf/ABC123-datasheet.pdf">ABC123 Datasheet</a>',
    };
  });

  const first = await service.discover({ model: 'ABC123', manufacturer: 'Example' });
  const second = await service.discover({ model: 'ABC123', manufacturer: 'Example' });

  assert.equal(first.documents.length, 1);
  assert.equal(first.documents[0].kind, 'datasheet');
  assert.equal(first.documents[0].sourceName, adapter.name);
  assert.deepEqual(second, first);
  assert.equal(fetchCount, 1);
});

test('part document service reports unsupported manufacturers without network access', async () => {
  const service = createPartDocumentService({ adapters: [] });
  const result = await service.discover({ model: 'UNKNOWN1', manufacturer: 'Unknown Vendor' });
  assert.equal(result.documents.length, 0);
  assert.equal(result.failures[0].code, 'unsupported-manufacturer');
});

test('part document URL validation rejects credentials and unregistered domains', () => {
  const service = createPartDocumentService({ adapters: [adapter] });
  assert.throws(() => service.validateUrl('https://user:secret@docs.example.com/a.pdf'), /registered manufacturer domain/);
  assert.throws(() => service.validateUrl('https://example.invalid/a.pdf'), /registered manufacturer domain/);
});
