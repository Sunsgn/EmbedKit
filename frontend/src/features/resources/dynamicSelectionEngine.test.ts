import { describe, expect, it } from 'vitest';
import type { PartParameter, PartRecord, SelectionConstraint } from '../../types';
import { evaluateDynamicPartSelection, rankDynamicPartSelections } from './selectionEngine';
import { parameterDefinitions } from './selectionRegistry';

const parameter = (input: Partial<PartParameter> & Pick<PartParameter, 'key' | 'label'>): PartParameter => ({ valueType: 'number', conditions: [], evidenceIds: ['official:p1'], status: 'verified', ...input });
const part = (id: string, parameters: PartParameter[]): PartRecord => ({ schemaVersion: 1, id, manufacturer: 'Example', mpn: id, category: 'MCU', subcategory: 'MCU', description: '', tags: [], variants: [{ mpn: id, lifecycle: 'active' }], parameters, documents: [], sources: [], evidence: [], createdAt: '', updatedAt: '' });

describe('dynamic selection engine', () => {
  it('converts compatible units and keeps preference separate from required qualification', () => {
    const constraints: SelectionConstraint[] = [
      { id: 'flash', parameterId: 'mcu.flash', valueType: 'number', operator: 'at-least', value: 1, unit: 'MB', priority: 'required', source: 'user' },
      { id: 'clock', parameterId: 'mcu.clock', valueType: 'number', operator: 'at-least', value: 200, unit: 'MHz', priority: 'preferred', source: 'user' },
    ];
    const result = evaluateDynamicPartSelection(part('mcu', [parameter({ key: 'flash-kb', label: 'Flash', value: 2048, unit: 'KB' }), parameter({ key: 'clock-mhz', label: 'Clock', value: 120, unit: 'MHz' })]), constraints, parameterDefinitions);
    expect(result).toMatchObject({ outcome: 'eligible', requiredMatched: 1, preferredMatched: 0 });
    expect(result.evaluations.find(item => item.criterionId === 'clock')?.outcome).toBe('mismatch');
  });

  it('reports unknown parameters and illegal dimensions without treating them as matches', () => {
    const missing: SelectionConstraint = { id: 'custom', parameterKey: 'unknown-key', customName: '启动时间', valueType: 'number', operator: 'at-most', value: 10, unit: 'ms', priority: 'required', source: 'user' };
    const invalidUnit: SelectionConstraint = { id: 'unit', parameterId: 'mcu.flash', valueType: 'number', operator: 'at-least', value: 5, unit: 'V', priority: 'required', source: 'user' };
    const result = evaluateDynamicPartSelection(part('mcu', [parameter({ key: 'flash-kb', label: 'Flash', value: 512, unit: 'KB' })]), [missing, invalidUnit], parameterDefinitions);
    expect(result.outcome).toBe('needs-verification');
    expect(result.evaluations.map(item => item.outcome)).toEqual(['unknown', 'unknown']);
    expect(result.evaluations[1].message).toMatch(/量纲不一致/);
  });

  it('ranks verified qualification before unresolved and required mismatches', () => {
    const constraint: SelectionConstraint = { id: 'flash', parameterId: 'mcu.flash', valueType: 'number', operator: 'at-least', value: 256, unit: 'KB', priority: 'required', source: 'user' };
    const results = rankDynamicPartSelections([part('bad', [parameter({ key: 'flash-kb', label: 'Flash', value: 128, unit: 'KB' })]), part('unknown', []), part('good', [parameter({ key: 'flash-kb', label: 'Flash', value: 512, unit: 'KB' })])], [constraint], parameterDefinitions);
    expect(results.map(item => item.outcome)).toEqual(['eligible', 'needs-verification', 'excluded']);
  });

  it('compares explicit boolean conditions deterministically', () => {
    const constraint: SelectionConstraint = { id: 'dma', parameterKey: 'dma', customName: 'DMA', valueType: 'boolean', operator: 'equals', value: true, priority: 'required', source: 'user' };
    const result = evaluateDynamicPartSelection(part('mcu', [parameter({ key: 'dma', label: 'DMA', valueType: 'boolean', value: true })]), [constraint], parameterDefinitions);
    expect(result).toMatchObject({ outcome: 'eligible', requiredMatched: 1 });
  });

  it('matches arbitrary custom names to raw candidate fields and parses text ranges', () => {
    const constraint: SelectionConstraint = { id: 'temperature', customName: '工作温度', valueType: 'range', operator: 'contains-range', min: -20, max: 70, unit: '°C', priority: 'required', source: 'user' };
    const result = evaluateDynamicPartSelection(part('online-mcu', [parameter({ key: 'online-7', label: '工作温度范围', valueType: 'text', value: '-40 – 85 °C', status: 'imported' })]), [constraint], parameterDefinitions);
    expect(result.outcome).toBe('needs-verification');
    expect(result.evaluations[0]).toMatchObject({ outcome: 'match', parameterStatus: 'imported' });
  });

  it('supports unregistered numeric fields without adding product code', () => {
    const constraint: SelectionConstraint = { id: 'current', customName: '待机电流', valueType: 'number', operator: 'at-most', value: 20, unit: 'mA', priority: 'required', source: 'user' };
    const result = evaluateDynamicPartSelection(part('custom', [parameter({ key: 'raw-current', label: '待机电流', valueType: 'text', value: '12 mA' })]), [constraint], []);
    expect(result).toMatchObject({ outcome: 'eligible', requiredMatched: 1 });
  });

  it('does not guess when multiple raw fields could satisfy one custom name', () => {
    const constraint: SelectionConstraint = { id: 'temperature', customName: '工作温度', valueType: 'range', operator: 'contains-range', min: -20, max: 70, unit: '°C', priority: 'required', source: 'user' };
    const result = evaluateDynamicPartSelection(part('ambiguous', [
      parameter({ key: 'ambient', label: '工作温度（环境）', valueType: 'text', value: '-40–85 °C' }),
      parameter({ key: 'junction', label: '工作温度（结温）', valueType: 'text', value: '-40–125 °C' }),
    ]), [constraint], parameterDefinitions);
    expect(result.outcome).toBe('needs-verification');
    expect(result.evaluations[0]).toMatchObject({ outcome: 'unknown' });
    expect(result.evaluations[0].message).toMatch(/手动指定参数键/);
  });
});
