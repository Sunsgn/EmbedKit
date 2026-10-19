import { describe, expect, it } from 'vitest';
import type { PartParameter, PartRecord } from '../../types';
import { evaluatePartSelection, rankPartSelections, type SelectionCriterion } from './selectionEngine';

const parameter = (input: Partial<PartParameter> & Pick<PartParameter, 'key' | 'label'>): PartParameter => ({
  valueType: 'text', conditions: [], evidenceIds: ['datasheet:p1'], status: 'verified', ...input,
});

const part = (id: string, parameters: PartParameter[]): PartRecord => ({
  schemaVersion: 1, id, manufacturer: 'Example', mpn: id.toUpperCase(), category: '接口与通信', subcategory: '收发器', description: 'test', tags: [],
  variants: [{ mpn: id.toUpperCase(), lifecycle: 'active' }], parameters, documents: [], sources: [{ id: 'official', kind: 'manufacturer', name: 'Official' }], evidence: [], createdAt: '', updatedAt: '',
});

const criteria: SelectionCriterion[] = [
  { id: 'bus', key: 'bus-standard', label: '总线标准', required: true, operator: 'equals', value: 'CAN FD' },
  { id: 'rate', key: 'data-rate-mbps', label: '最低速率', required: true, operator: 'at-least', value: 2, unit: 'Mbps' },
  { id: 'temperature', key: 'temperature-c', label: '工作温度', required: true, operator: 'contains-range', min: -40, max: 105, unit: '°C' },
];

describe('part selection engine', () => {
  it('marks a fully evidenced candidate eligible', () => {
    const result = evaluatePartSelection(part('good', [
      parameter({ key: 'bus-standard', label: '标准', valueType: 'enum', value: ['CAN', 'CAN FD'] }),
      parameter({ key: 'data-rate-mbps', label: '速率', valueType: 'number', value: 5, unit: 'Mbps' }),
      parameter({ key: 'temperature-c', label: '温度', valueType: 'range', min: -40, max: 125, unit: '°C' }),
    ]), criteria);
    expect(result).toMatchObject({ outcome: 'eligible', matched: 3, unknown: 0, mismatched: 0 });
  });

  it('excludes any candidate that fails a mandatory condition and preserves the reason', () => {
    const result = evaluatePartSelection(part('slow', [
      parameter({ key: 'bus-standard', label: '标准', valueType: 'enum', value: 'CAN FD' }),
      parameter({ key: 'data-rate-mbps', label: '速率', valueType: 'number', value: 1, unit: 'Mbps' }),
      parameter({ key: 'temperature-c', label: '温度', valueType: 'range', min: -40, max: 125, unit: '°C' }),
    ]), criteria);
    expect(result.outcome).toBe('excluded');
    expect(result.evaluations.find(item => item.criterionId === 'rate')).toMatchObject({ outcome: 'mismatch', message: '不满足：1' });
  });

  it('does not treat absent, conflicting, or unverified data as verified compliance', () => {
    const result = evaluatePartSelection(part('uncertain', [
      parameter({ key: 'bus-standard', label: '标准', valueType: 'enum', value: 'CAN FD', status: 'imported' }),
      parameter({ key: 'data-rate-mbps', label: '速率', valueType: 'number', value: 5 }),
      parameter({ key: 'temperature-c', label: '温度', valueType: 'range', status: 'conflict', min: -40, max: 125 }),
    ]), criteria);
    expect(result).toMatchObject({ outcome: 'needs-verification', matched: 2, unknown: 1 });
  });

  it('ranks eligible, unresolved, and excluded candidates deterministically', () => {
    const good = part('good', [parameter({ key: 'bus-standard', label: '标准', value: 'CAN FD' }), parameter({ key: 'data-rate-mbps', label: '速率', value: 5 }), parameter({ key: 'temperature-c', label: '温度', min: -40, max: 125 })]);
    const unknown = part('unknown', [parameter({ key: 'bus-standard', label: '标准', value: 'CAN FD' })]);
    const bad = part('bad', [parameter({ key: 'bus-standard', label: '标准', value: 'CAN' })]);
    expect(rankPartSelections([bad, unknown, good], criteria).map(item => item.outcome)).toEqual(['eligible', 'needs-verification', 'excluded']);
  });
});
