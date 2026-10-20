import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PartParameter } from '../../types';
import DynamicConstraintEditor from './DynamicConstraintEditor';

describe('DynamicConstraintEditor', () => {
  it('maps a common custom name to the registered temperature definition', () => {
    const onChange = vi.fn();
    render(<DynamicConstraintEditor categoryId="mcu" constraints={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '自定义条件' }));
    fireEvent.change(screen.getByLabelText('自定义条件名称'), { target: { value: '温度' } });
    fireEvent.click(screen.getByRole('button', { name: '确认' }));
    expect(onChange.mock.calls[0][0][0]).toMatchObject({ parameterId: 'mcu.temperature', parameterKey: 'temperature-c', valueType: 'range', operator: 'contains-range' });
  });

  it('lets arbitrary conditions map to fields discovered from real candidates', () => {
    const onChange = vi.fn();
    const availableParameters: PartParameter[] = [{ key: 'raw-current', label: '待机电流', valueType: 'text', value: '12 mA', conditions: [], evidenceIds: [], status: 'imported' }];
    render(<DynamicConstraintEditor categoryId="custom" constraints={[]} availableParameters={availableParameters} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '自定义条件' }));
    fireEvent.change(screen.getByLabelText('自定义条件名称'), { target: { value: '低功耗要求' } });
    fireEvent.change(screen.getByLabelText('自定义参数键'), { target: { value: 'raw-current' } });
    fireEvent.change(screen.getByLabelText('自定义值类型'), { target: { value: 'number' } });
    fireEvent.click(screen.getByRole('button', { name: '确认' }));
    expect(onChange.mock.calls[0][0][0]).toMatchObject({ customName: '低功耗要求', parameterKey: 'raw-current', valueType: 'number', operator: 'at-least' });
  });
});
