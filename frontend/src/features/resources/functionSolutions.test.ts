import { beforeEach, describe, expect, it } from 'vitest';
import { communicationSelectionCatalog } from './communicationSelectionCatalog';
import { createFunctionSolution, FUNCTION_SOLUTION_ROLE_LIMIT, listFunctionSolutions, migratePartSelectionRecord, parseFunctionSolution, saveFunctionSolution } from './functionSolutions';
import { functionTemplates } from './selectionRegistry';
import { savePartSelectionRecord } from './selectionRecords';
import { rankPartSelections, type SelectionCriterion } from './selectionEngine';

beforeEach(() => localStorage.clear());

describe('function solution records', () => {
  it('saves and restores a versioned multi-role solution', () => {
    const solution = createFunctionSolution(functionTemplates[0]);
    const saved = saveFunctionSolution(solution);
    expect(listFunctionSolutions()[0]).toMatchObject({ id: saved.id, schemaVersion: 2, name: '工业通信节点' });
    expect(listFunctionSolutions()[0].roles.length).toBeGreaterThan(2);
  });

  it('reads legacy selection records as a single-role solution without losing evidence', () => {
    const criteria: SelectionCriterion[] = [{ id: 'standard', key: 'bus-standard', label: '总线标准', required: true, operator: 'equals', value: 'CAN FD' }];
    const record = savePartSelectionRecord({ name: '旧 CAN FD 选型', scope: 'communication-transceiver', criteria, parts: communicationSelectionCatalog, evaluations: rankPartSelections(communicationSelectionCatalog, criteria) });
    const migrated = listFunctionSolutions()[0];
    expect(migrated).toMatchObject({ id: `migrated:${record.id}`, migratedFrom: { schemaVersion: 1, recordId: record.id }, roles: [{ categoryId: 'communication-transceiver' }] });
    expect(migrated.parts).toHaveLength(communicationSelectionCatalog.length);
    expect(migratePartSelectionRecord(record).roles[0].constraints[0]).toMatchObject({ parameterKey: 'bus-standard', priority: 'required' });
  });

  it('isolates malformed and oversized solutions', () => {
    expect(parseFunctionSolution({ schemaVersion: 2 })).toBeNull();
    const solution = createFunctionSolution(functionTemplates[2]);
    solution.roles = Array.from({ length: FUNCTION_SOLUTION_ROLE_LIMIT + 1 }, (_, index) => ({ id: `role-${index}`, categoryId: 'custom', name: 'role', purpose: '', constraints: [], candidatePartIds: [] }));
    expect(() => saveFunctionSolution(solution)).toThrow(/无效|上限/);
    localStorage.setItem('embedkit.function-solutions', '{broken');
    expect(listFunctionSolutions()).toEqual([]);
  });
});
