import { describe, expect, it } from 'vitest';
import type { Chip, ElectronicComponent } from '../types';
import { migrateChip, migrateElectronicComponent, normalizePartRecord, PART_PARAMETER_LIMIT } from './partCatalog';

const component: ElectronicComponent = {
  id: 'max3485',
  name: 'MAX3485',
  manufacturer: 'Analog Devices',
  category: '接口与通信',
  subcategory: 'RS-485 收发器',
  description: '3.3V 半双工 RS-485 收发器。',
  package: 'SOIC-8',
  parameters: { 电源: '3.3V', 数据速率: '10Mbps' },
  tags: ['RS485', 'RS485'],
  datasheetUrl: 'https://example.com/max3485.pdf',
};

describe('part catalog compatibility model', () => {
  it('migrates a legacy component without presenting free-text parameters as verified', () => {
    const result = migrateElectronicComponent(component);
    expect(result).toMatchObject({ schemaVersion: 1, mpn: 'MAX3485', category: '接口与通信' });
    expect(result.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '电源', value: '3.3V', valueType: 'text', status: 'imported' }),
    ]));
    expect(new Set(result.parameters.map(item => item.key)).size).toBe(result.parameters.length);
    expect(result.documents[0]).toMatchObject({ kind: 'datasheet', url: 'https://example.com/max3485.pdf' });
    expect(result.tags).toEqual(['RS485']);
    expect(result.evidence[0].note).toContain('尚未完成官方文档逐项核验');
  });

  it('migrates chip-specific fields and preserves peripheral evidence', () => {
    const chip: Chip = { id: 'demo-mcu', name: 'DEMO100', manufacturer: 'Example', series: 'Demo', cores: 'Cortex-M', frequency: '100MHz', flash: '512KB', ram: '128KB', peripherals: ['CAN FD', 'UART'], package: 'LQFP-64' };
    const result = migrateChip(chip);
    expect(result.variants[0]).toMatchObject({ mpn: 'DEMO100', package: 'LQFP-64', lifecycle: 'unknown' });
    expect(result.parameters.find(item => item.label === '外设')?.value).toBe('CAN FD、UART');
  });

  it('accepts bounded versioned records and rejects malformed or unbounded input', () => {
    const valid = migrateElectronicComponent(component);
    expect(normalizePartRecord(valid)?.id).toBe(valid.id);
    expect(normalizePartRecord({ ...valid, schemaVersion: 99 })).toBeNull();
    expect(normalizePartRecord({ ...valid, sources: [] })).toBeNull();
    expect(normalizePartRecord({ ...valid, parameters: Array(PART_PARAMETER_LIMIT + 1).fill(valid.parameters[0]) })).toBeNull();
  });

  it('drops unsafe document URLs during legacy migration', () => {
    const result = migrateElectronicComponent({ ...component, datasheetUrl: 'javascript:alert(1)', reference: 'file:///secret/manual.pdf' });
    expect(result.documents).toEqual([]);
  });
});
