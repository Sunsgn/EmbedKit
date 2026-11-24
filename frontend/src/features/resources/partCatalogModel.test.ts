import { describe, expect, it } from 'vitest';
import { buildPartSearchLinks, describeTypicalPartUse, filterPartCatalog, findExactPart, supportsPartDocumentation, type PartCatalogItem } from './partCatalogModel';

const item = (overrides: Partial<PartCatalogItem> = {}): PartCatalogItem => ({ name: 'STM32F407VG', manufacturer: 'ST', category: '微控制器与处理器', subcategory: 'Cortex-M4', description: '通用 MCU', package: 'LQFP100', parameters: { 主频: '168 MHz' }, tags: ['CAN', 'ETH'], isChip: true, ...overrides });

describe('part catalog model', () => {
  it('builds encoded bounded external lookup links', () => {
    expect(buildPartSearchLinks('x')).toEqual([]);
    const links = buildPartSearchLinks('STM32 F407');
    expect(links).toHaveLength(10);
    expect(links[0]).toMatchObject({ source: 'AllDatasheet', link: expect.stringContaining('STM32%20F407') });
  });

  it('filters all catalog evidence fields and resolves normalized exact models', () => {
    const catalog = [item(), item({ name: 'BME280', manufacturer: 'Bosch', category: '传感器', subcategory: '环境', parameters: { 接口: 'I2C SPI' }, tags: [] })];
    expect(filterPartCatalog(catalog, '168 CAN', '', 'ST')).toEqual([catalog[0]]);
    expect(filterPartCatalog(catalog, 'i2c', '传感器')).toEqual([catalog[1]]);
    expect(findExactPart(catalog, catalog, 'stm32-f407-vg')).toBe(catalog[0]);
  });

  it('describes uses without treating every part as a chip document set', () => {
    expect(describeTypicalPartUse(item())).toContain('工业控制');
    expect(describeTypicalPartUse(item({ isChip: false, description: '精密电阻' }))).toBe('精密电阻');
    expect(supportsPartDocumentation(item({ isChip: false, category: '无源器件' }))).toBe(false);
    expect(supportsPartDocumentation(item())).toBe(true);
  });
});
