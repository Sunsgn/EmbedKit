import { describe, expect, it } from 'vitest';
import { deleteProjectLocalBinding, getProjectLocalBinding, saveProjectLocalBinding } from './projectLocalBindings';

describe('project local bindings', () => {
  it('keeps an absolute path in local-only storage and supports replacement and deletion', () => {
    saveProjectLocalBinding({ projectId: 'p1', path: 'D:\\firmware', verifiedAt: '2026-10-15T00:00:00.000Z' });
    saveProjectLocalBinding({ projectId: 'p1', path: 'E:\\moved', verifiedAt: '2026-10-15T01:00:00.000Z' });
    expect(getProjectLocalBinding('p1')?.path).toBe('E:\\moved');
    deleteProjectLocalBinding('p1');
    expect(getProjectLocalBinding('p1')).toBeNull();
  });
});
