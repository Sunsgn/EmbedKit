import { describe, expect, it } from 'vitest';
import { buildOfficialDocumentLinks, documentAccessLabel, mergeDiscoveredDocuments } from './partDocumentDiscovery';

describe('part document discovery', () => {
  it('builds a complete MCU document package from official manufacturer navigation', () => {
    const links = buildOfficialDocumentLinks({ model: 'STM32G474RET6', manufacturer: 'STMicroelectronics', category: '微控制器与处理器', datasheetUrl: 'https://www.st.com/resource/en/datasheet/stm32g474re.pdf' });
    expect(links.map((link) => link.kind)).toEqual(expect.arrayContaining(['datasheet', 'reference-manual', 'user-guide', 'programming-manual', 'application-note', 'errata', 'hardware-design-guide', 'getting-started-guide']));
    expect(links.find((link) => link.kind === 'datasheet')).toMatchObject({ authoritative: true, access: 'official-pdf' });
    expect(links.find((link) => link.kind === 'user-guide')).toMatchObject({ authoritative: true, access: 'official-search', sourceName: 'STMicroelectronics' });
  });

  it('includes usage and hardware guidance for a non-MCU part', () => {
    const kinds = buildOfficialDocumentLinks({ model: 'BME280', manufacturer: 'Bosch Sensortec', category: '传感器' }).map((link) => link.kind);
    expect(kinds).toEqual(expect.arrayContaining(['datasheet', 'user-guide', 'application-note', 'hardware-design-guide', 'getting-started-guide']));
    expect(kinds).not.toContain('programming-manual');
  });

  it('labels official search, site search and unsafe direct URLs without overstating evidence', () => {
    const official = buildOfficialDocumentLinks({ model: 'ESP32-S3', manufacturer: 'Espressif', isMcu: true });
    expect(documentAccessLabel(official.find((link) => link.kind === 'user-guide')!)).toBe('厂商官网检索');
    const siteSearch = buildOfficialDocumentLinks({ model: 'BME280', manufacturer: 'Bosch Sensortec' });
    expect(documentAccessLabel(siteSearch[0])).toBe('官方站点定向搜索');
    expect(siteSearch[0].authoritative).toBe(false);
    const unknown = buildOfficialDocumentLinks({ model: 'SAFE100', manufacturer: 'Unknown Vendor', datasheetUrl: 'javascript:alert(1)' });
    expect(unknown[0].url).toMatch(/^https:\/\//);
    expect(documentAccessLabel(unknown[0])).toBe('Web 检索 · 厂商待确认');
    expect(unknown.length).toBeLessThanOrEqual(12);
    expect(new Set(unknown.map((link) => `${link.kind}:${link.url}`)).size).toBe(unknown.length);
  });

  it('infers the official manufacturer from a known product URL', () => {
    const links = buildOfficialDocumentLinks({ model: 'TCAN1042', productUrl: 'https://www.ti.com/product/TCAN1042' });
    expect(links.find((link) => link.kind === 'product-page')).toMatchObject({ sourceName: 'Texas Instruments', authoritative: true });
    expect(links.find((link) => link.kind === 'user-guide')?.url).toContain('ti.com');
  });

  it('replaces search placeholders with discovered official PDFs and keeps missing fallbacks', () => {
    const base = buildOfficialDocumentLinks({ model: 'TCAN1042', manufacturer: 'Texas Instruments' });
    const merged = mergeDiscoveredDocuments(base, [{ kind: 'user-guide', title: 'TCAN1042 User Guide', url: 'https://www.ti.com/lit/ug/tcan1042.pdf', sourceName: 'Texas Instruments', authoritative: true, scope: 'exact-model', discoveredFrom: 'https://www.ti.com/product/TCAN1042' }]);
    expect(merged.find((link) => link.kind === 'user-guide')).toMatchObject({ access: 'official-pdf', scope: 'exact-model' });
    expect(documentAccessLabel(merged.find((link) => link.kind === 'user-guide')!)).toBe('打开官方 PDF');
    expect(merged.some((link) => link.kind === 'datasheet')).toBe(true);
  });
});
