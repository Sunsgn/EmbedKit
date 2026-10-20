import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SelectionRecordManager from './SelectionRecordManager';
import { communicationSelectionCatalog } from './communicationSelectionCatalog';
import { rankPartSelections, type SelectionCriterion } from './selectionEngine';
import { listPartSelectionRecords } from './selectionRecords';

const criteria: SelectionCriterion[] = [{ id: 'standard', key: 'bus-standard', label: '总线标准', required: true, operator: 'equals', value: 'CAN FD' }];
beforeEach(() => localStorage.clear());
describe('SelectionRecordManager', () => {
  it('saves, restores, and explicitly confirms deletion', () => {
    const onRestore = vi.fn(), confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SelectionRecordManager scope="communication-transceiver" name="CAN FD 选型" criteria={criteria} parts={communicationSelectionCatalog} evaluations={rankPartSelections(communicationSelectionCatalog, criteria)} onRestore={onRestore} />);
    fireEvent.click(screen.getByRole('button', { name: '保存当前选型' }));
    expect(screen.getByRole('status')).toHaveTextContent('已保存');
    expect(listPartSelectionRecords()).toHaveLength(1);
    fireEvent.click(screen.getByText('选型记录 1'));
    fireEvent.click(screen.getByTitle('恢复记录'));
    expect(onRestore).toHaveBeenCalledWith(expect.objectContaining({ name: 'CAN FD 选型' }));
    fireEvent.click(screen.getByTitle('删除记录'));
    expect(confirm).toHaveBeenCalled();
    expect(listPartSelectionRecords()).toEqual([]);
  });
});
