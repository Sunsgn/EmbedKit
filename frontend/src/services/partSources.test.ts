import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPartSourceStatus, lookupOnlinePart, onlineDetailsToPart } from './partSources';

afterEach(() => vi.unstubAllGlobals());
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', 'X-EmbedKit-Protocol': '1' } });
describe('online part sources', () => {
  it('reads bounded source capabilities from Local Agent', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ schemaVersion: 1, sources: [{ id: 'official', name: 'Official', kind: 'manufacturer', state: 'configured', capabilities: ['product-page-link'], dataScope: 'part number', authoritative: true }], limits: { queryLength: 120, automaticPdfDownload: false, parametricSearch: false } }))); await expect(getPartSourceStatus()).resolves.toMatchObject({ limits: { parametricSearch: false } }); });
  it('preserves lookup fields with stable keys as unverified evidence', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ productName: 'TCAN1042', description: 'CAN transceiver', source: 'Aggregator', specs: { voltage: '4.5-5.5 V' }, productUrl: 'https://example.com/TCAN1042' }))); const part = onlineDetailsToPart(await lookupOnlinePart('TCAN1042')); expect(part).toMatchObject({ mpn: 'TCAN1042', category: '在线发现器件' }); expect(part.parameters[0]).toMatchObject({ key: 'raw:voltage', value: '4.5-5.5 V', status: 'imported' }); expect(part.evidence[0].note).toContain('通用条件匹配'); });
  it('rejects unsafe queries and returned URLs', async () => { await expect(lookupOnlinePart('x')).rejects.toThrow(/2～120/); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ productName: 'SAFE100', source: 'Test', productUrl: 'javascript:alert(1)' }))); expect((await lookupOnlinePart('SAFE100')).productUrl).toBeUndefined(); });
});
