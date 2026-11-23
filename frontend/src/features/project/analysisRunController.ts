import type { FileNode } from '../../types';
import type { ProjectAnalysisRun } from '../../types/projectAnalysis';
import type { ProjectArchitecture } from '../../utils/projectArchitecture';
import type { ProgramBehavior } from '../../utils/programBehavior';
import { staticCoverage, type RuntimeTraceAnalysis } from '../../utils/runtimeTrace';
import { saveProjectAnalysisRun } from '../../services/productStorage';
import { createWorkspaceFingerprint } from '../../services/workspaceStorage';
import { createCompletedProjectAnalysisRun } from '../../services/projectAnalysisSnapshot';

type AnalysisInput = Parameters<typeof createCompletedProjectAnalysisRun>[0];

export interface SaveAnalysisRunInput {
  projectId: string;
  projectRevisionId: string;
  sourceFingerprint: string;
  files: FileNode[];
  architecture: ProjectArchitecture;
  behavior: ProgramBehavior;
  findings: AnalysisInput['findings'];
  runtimeTrace: RuntimeTraceAnalysis | null;
}

interface AnalysisRunDependencies {
  fingerprint: (files: FileNode[]) => Promise<string>;
  createRun: typeof createCompletedProjectAnalysisRun;
  persistRun: (run: ProjectAnalysisRun) => Promise<void>;
}

const defaultDependencies: AnalysisRunDependencies = {
  fingerprint: createWorkspaceFingerprint,
  createRun: createCompletedProjectAnalysisRun,
  persistRun: saveProjectAnalysisRun,
};

export async function saveCompletedAnalysisRun(input: SaveAnalysisRunInput, overrides: Partial<AnalysisRunDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const inputFingerprint = await dependencies.fingerprint(input.files);
  const staticNames = input.architecture.flows.flatMap(flow => flow.steps.filter(step => step.internal).map(step => step.name));
  const runtimeCoverage = input.runtimeTrace ? staticCoverage(staticNames, input.runtimeTrace) : null;
  const run = dependencies.createRun({
    projectId: input.projectId,
    projectRevisionId: input.projectRevisionId,
    sourceFingerprint: input.sourceFingerprint,
    inputFingerprint,
    architecture: input.architecture,
    behavior: input.behavior,
    findings: input.findings,
    runtimeEvents: input.runtimeTrace?.events.length ?? 0,
    runtimeRate: runtimeCoverage?.rate,
  });
  await dependencies.persistRun(run);
  return run;
}

export function mergeAnalysisRunHistory(current: ProjectAnalysisRun[], run: ProjectAnalysisRun, limit = 1000) {
  return [run, ...current.filter(item => item.id !== run.id)].slice(0, Math.max(1, limit));
}

export function analysisRunSavedMessage(run: ProjectAnalysisRun) {
  return `分析证据已保存：${run.findings.length} 项结论，调用解析率 ${(run.coverage.resolvedRate * 100).toFixed(0)}%。`;
}
