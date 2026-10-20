import FunctionSolutionWorkbench from './FunctionSolutionWorkbench';
import type { FunctionSolution } from '../../types';

export default function FunctionalSelectionCenter({ initialSolution }: { initialSolution?: FunctionSolution }) {
  return <FunctionSolutionWorkbench initialSolution={initialSolution} />;
}
