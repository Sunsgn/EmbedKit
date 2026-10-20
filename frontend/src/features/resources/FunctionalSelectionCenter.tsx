import { useState } from 'react';
import type { FunctionSolution } from '../../types';
import FunctionSolutionWorkbench from './FunctionSolutionWorkbench';
import SelectionSolutionLauncher, { type SelectionLaunchResult } from './SelectionSolutionLauncher';
import { clearSelectionWorkspaceDraft, loadSelectionWorkspaceDraft, saveSelectionWorkspaceDraft } from './selectionWorkspaceDraft';

export default function FunctionalSelectionCenter({ initialSolution }: { initialSolution?: FunctionSolution }) {
  const [draft, setDraft] = useState(() => loadSelectionWorkspaceDraft());
  const [active, setActive] = useState<SelectionLaunchResult | null>(() =>
    initialSolution
      ? {
          solution: initialSolution,
          intakeKind: 'template',
          intakeText: '',
          targetRoleId: initialSolution.roles[0]?.id,
        }
      : null,
  );
  if (!active)
    return (
      <SelectionSolutionLauncher
        draft={draft}
        onDiscardDraft={() => {
          clearSelectionWorkspaceDraft();
          setDraft(null);
        }}
        onStart={(result) => {
          saveSelectionWorkspaceDraft(result);
          setActive(result);
        }}
      />
    );
  return (
    <FunctionSolutionWorkbench
      initialSolution={active.solution}
      initialRoleId={active.targetRoleId}
      initialTab={active.intakeKind === 'recommendation' || active.intakeKind === 'models' ? 'candidates' : 'constraints'}
      initialRecommendationText={active.intakeKind === 'recommendation' || active.intakeKind === 'models' ? active.intakeText : ''}
      onBack={() => {
        setDraft(loadSelectionWorkspaceDraft());
        setActive(null);
      }}
      onChange={(solution) => saveSelectionWorkspaceDraft({ ...active, solution })}
    />
  );
}
