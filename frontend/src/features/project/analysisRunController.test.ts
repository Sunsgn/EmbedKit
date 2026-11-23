import { describe, expect, it, vi } from 'vitest';
import type { ProjectAnalysisRun } from '../../types/projectAnalysis';
import type { ProjectArchitecture } from '../../utils/projectArchitecture';
import type { ProgramBehavior } from '../../utils/programBehavior';
import { analysisRunSavedMessage, mergeAnalysisRunHistory, saveCompletedAnalysisRun } from './analysisRunController';

const root = { id: 'node:main', name: 'main', kind: 'entry' as const, file: '/main.c', line: 1, evidence: 'main', calls: ['worker'], callSites: [] };
const architecture: ProjectArchitecture = {
  runtime: 'bare-metal', confidence: 'high', evidence: ['main'], entries: [root], tasks: [], interrupts: [], callbacks: [], initChain: [], layers: [], edges: [], unknownCalls: 0, ambiguities: [],
  flows: [{ id: 'flow:main', title: 'main', context: 'startup', root, confidence: 'high', notes: [], steps: [
    { id: 'step:main', name: 'main', file: '/main.c', line: 1, depth: 0, relation: 'start', control: 'sequence', internal: true },
    { id: 'step:worker', name: 'worker', file: '/main.c', line: 2, depth: 1, relation: 'call', control: 'sequence', internal: true },
  ] }],
  coverage: { sourceFiles: 1, parsedFunctions: 2, callSites: 1, resolvedCallSites: 1, resolvedRate: 1 },
};
const behavior: ProgramBehavior = { stateMachines: [], resources: [], tasks: [], callbacks: [], metadata: { compileCommands: false, keilProject: false, iarProject: false, confidence: 'low', evidence: [] } };

describe('project analysis run controller', () => {
  it('fingerprints, correlates runtime evidence, and persists one completed run', async () => {
    const persistRun = vi.fn(async () => undefined);
    const run = await saveCompletedAnalysisRun({
      projectId: 'project-1', projectRevisionId: 'revision-1', sourceFingerprint: 'source-sha',
      files: [{ name: 'main.c', path: '/main.c', content: 'int main(void){}', language: 'c' }], architecture, behavior, findings: [],
      runtimeTrace: { events: [{ id: 'event-1', timestamp: 0, type: 'enter', name: 'main', raw: 'main', line: 1 }], executedNames: new Set(['main']), contexts: [], durationMs: 0, warnings: [] },
    }, { fingerprint: async () => 'input-sha', persistRun });
    expect(run.inputFingerprint).toBe('input-sha');
    expect(run.dirty).toBe(true);
    expect(run.coverage.runtimeEvents).toBe(1);
    expect(run.coverage.runtimeRate).toBe(0.5);
    expect(persistRun).toHaveBeenCalledWith(run);
  });

  it('deduplicates bounded history and formats the persisted evidence summary', () => {
    const run = { id: 'run-1', findings: [{ id: 'finding-1' }], coverage: { resolvedRate: 0.75 } } as ProjectAnalysisRun;
    const older = [{ id: 'run-1' }, { id: 'run-2' }, { id: 'run-3' }] as ProjectAnalysisRun[];
    expect(mergeAnalysisRunHistory(older, run, 2).map(item => item.id)).toEqual(['run-1', 'run-2']);
    expect(analysisRunSavedMessage(run)).toBe('分析证据已保存：1 项结论，调用解析率 75%。');
  });
});
