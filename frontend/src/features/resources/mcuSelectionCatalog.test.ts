import { describe, expect, it } from 'vitest';
import { mcuSelectionCatalog } from './mcuSelectionCatalog';
import { rankPartSelections, type SelectionCriterion } from './selectionEngine';

describe('MCU selection catalog', () => {
  it('keeps a bounded multi-vendor catalog with structured imported evidence', () => {
    expect(mcuSelectionCatalog.length).toBeLessThanOrEqual(20);
    expect(new Set(mcuSelectionCatalog.map(item => item.manufacturer)).size).toBeGreaterThan(1);
    expect(mcuSelectionCatalog.every(item => item.parameters.every(parameter => parameter.status === 'imported' && parameter.evidenceIds.length > 0))).toBe(true);
  });
  it('filters MCU resources and peripherals with explicit reasons', () => {
    const criteria: SelectionCriterion[] = [
      { id: 'flash', key: 'flash-kb', label: 'Flash', required: true, operator: 'at-least', value: 256 },
      { id: 'ram', key: 'ram-kb', label: 'RAM', required: true, operator: 'at-least', value: 32 },
      { id: 'peripheral', key: 'peripheral', label: 'CAN', required: true, operator: 'equals', value: 'CAN' },
    ];
    const results = rankPartSelections(mcuSelectionCatalog, criteria);
    expect(results.some(item => item.mpn === 'STM32F103RCT6' && item.outcome === 'needs-verification')).toBe(true);
    expect(results.some(item => item.outcome === 'excluded' && item.mismatched > 0)).toBe(true);
  });
});
