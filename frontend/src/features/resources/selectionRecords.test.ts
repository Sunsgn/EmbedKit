import { beforeEach, describe, expect, it } from 'vitest';
import { communicationSelectionCatalog } from './communicationSelectionCatalog';
import { rankPartSelections, type SelectionCriterion } from './selectionEngine';
import { deletePartSelectionRecord, listPartSelectionRecords, parsePartSelectionRecord, PART_SELECTION_CANDIDATE_LIMIT, savePartSelectionRecord } from './selectionRecords';

const criteria: SelectionCriterion[] = [{ id: 'standard', key: 'bus-standard', label: '总线标准', required: true, operator: 'equals', value: 'CAN FD' }];
beforeEach(() => localStorage.clear());
describe('selection records', () => {
  it('saves, reloads, and deletes a versioned evidence snapshot', () => {
    const saved = savePartSelectionRecord({ name: 'CAN FD 选型', scope: 'communication-transceiver', criteria, parts: communicationSelectionCatalog, evaluations: rankPartSelections(communicationSelectionCatalog, criteria) });
    expect(listPartSelectionRecords()).toHaveLength(1);
    expect(listPartSelectionRecords()[0]).toMatchObject({ id: saved.id, name: 'CAN FD 选型', schemaVersion: 1 });
    deletePartSelectionRecord(saved.id);
    expect(listPartSelectionRecords()).toEqual([]);
  });
  it('rejects malformed, unrelated, and oversized snapshots', () => {
    expect(parsePartSelectionRecord({ schemaVersion: 1 })).toBeNull();
    expect(() => savePartSelectionRecord({ name: 'too many', scope: 'communication-transceiver', criteria, parts: Array(PART_SELECTION_CANDIDATE_LIMIT + 1).fill(communicationSelectionCatalog[0]), evaluations: [] })).toThrow(/最多/);
    localStorage.setItem('embedkit.part-selection-records', '{broken');
    expect(listPartSelectionRecords()).toEqual([]);
  });
});
