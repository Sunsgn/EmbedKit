import { beforeEach, describe, expect, it } from 'vitest';
import { createFunctionSolution } from './functionSolutions';
import { functionTemplates } from './selectionRegistry';
import { clearSelectionWorkspaceDraft, loadSelectionWorkspaceDraft, parseSelectionWorkspaceDraft, saveSelectionWorkspaceDraft, SELECTION_WORKSPACE_DRAFT_KEY } from './selectionWorkspaceDraft';

beforeEach(() => localStorage.clear());

describe('selection workspace draft', () => {
  it('saves and restores a versioned unfinished workspace', () => {
    const solution = createFunctionSolution(functionTemplates[0]);
    saveSelectionWorkspaceDraft({ solution, intakeKind: 'recommendation', intakeText: 'STM32G474RET6', targetRoleId: solution.roles[0].id });
    expect(loadSelectionWorkspaceDraft()).toMatchObject({ schemaVersion: 1, intakeKind: 'recommendation', intakeText: 'STM32G474RET6', solution: { id: solution.id } });
    clearSelectionWorkspaceDraft();
    expect(loadSelectionWorkspaceDraft()).toBeNull();
  });

  it('rejects damaged or structurally invalid drafts', () => {
    expect(parseSelectionWorkspaceDraft({ schemaVersion: 1 })).toBeNull();
    localStorage.setItem(SELECTION_WORKSPACE_DRAFT_KEY, '{broken');
    expect(loadSelectionWorkspaceDraft()).toBeNull();
  });
});
