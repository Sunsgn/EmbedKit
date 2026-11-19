import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { ProjectArchitecture } from '../utils/projectArchitecture';
import type { ProgramBehavior } from '../utils/programBehavior';
import { createCompletedProjectAnalysisRun } from './projectAnalysisSnapshot';
import { parseProjectAnalysisRun } from './projectAnalysisModel';
import { exportProductData, listProjectAnalysisRuns, saveProjectAnalysisRun } from './productStorage';

const architecture: ProjectArchitecture = {
  runtime: '通用裸机/未知框架',
  confidence: 'medium',
  evidence: ['发现 main 入口'],
  entries: [{ id: '/main.c:1:main', name: 'main', kind: 'entry', file: '/main.c', line: 1, evidence: 'main()', calls: ['work'], callSites: [] }],
  tasks: [], interrupts: [], callbacks: [], initChain: [], layers: [], edges: [], flows: [],
  unknownCalls: 2,
  coverage: { sourceFiles: 1, parsedFunctions: 2, callSites: 4, resolvedCallSites: 2, resolvedRate: 0.5 },
  ambiguities: [],
};

const behavior: ProgramBehavior = {
  stateMachines: [], resources: [], tasks: [], callbacks: [],
  metadata: { compileCommands: false, keilProject: false, iarProject: false, confidence: 'low', evidence: ['通用源码规则'] },
};

const makeRun = () => createCompletedProjectAnalysisRun({
  projectId: 'project-1',
  projectRevisionId: 'revision-1',
  sourceFingerprint: 'a'.repeat(64),
  inputFingerprint: 'b'.repeat(64),
  architecture,
  behavior,
  findings: [{ severity: 'high', title: '共享缓冲区缺少校验', file: '/main.c', line: 12, evidence: 'buffer[index]', recommendation: '增加边界校验并补充异常用例。' }],
  runtimeEvents: 0,
  startedAt: '2026-11-19T01:00:00.000Z',
  finishedAt: '2026-11-19T01:00:01.000Z',
});

const deleteDatabase = () => new Promise<void>((resolve) => {
  const request = indexedDB.deleteDatabase('embedkit-product');
  request.onsuccess = request.onerror = request.onblocked = () => resolve();
});

describe('project analysis runs', () => {
  afterEach(deleteDatabase);

  it('creates traceable deterministic evidence and marks edited input dirty', () => {
    const run = makeRun();

    expect(run).toMatchObject({ projectId: 'project-1', projectRevisionId: 'revision-1', dirty: true, status: 'completed', coverage: { resolvedRate: 0.5 } });
    expect(run.findings[0].evidenceIds).toEqual(['evidence:finding:0']);
    expect(run.evidence).toContainEqual(expect.objectContaining({ file: '/main.c', line: 12 }));
    expect(run.unknowns).toEqual(expect.arrayContaining([expect.stringContaining('真实设备运行轨迹'), expect.stringContaining('compile_commands.json')]));
    expect(parseProjectAnalysisRun(run)).toEqual(run);
  });

  it('rejects dangling evidence links and failed runs without structured errors', () => {
    const dangling = makeRun();
    dangling.findings[0].evidenceIds = ['missing'];
    expect(parseProjectAnalysisRun(dangling)).toBeNull();

    const failed = { ...makeRun(), status: 'failed' as const };
    expect(parseProjectAnalysisRun(failed)).toBeNull();
  });

  it('persists, lists and exports analysis runs through the versioned product store', async () => {
    const run = makeRun();
    await saveProjectAnalysisRun(run);

    expect(await listProjectAnalysisRuns()).toEqual([run]);
    expect((await exportProductData()).projectAnalysisRuns).toEqual([run]);
  });

  it('upgrades an existing v4 product database without losing project records', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('embedkit-product', 4);
      request.onupgradeneeded = () => request.result.createObjectStore('projects', { keyPath: 'id' }).put({ id: 'existing-project' });
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    });

    await saveProjectAnalysisRun(makeRun());

    expect(await listProjectAnalysisRuns()).toHaveLength(1);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('embedkit-product');
      request.onsuccess = () => {
        const database = request.result, transaction = database.transaction('projects', 'readonly'), get = transaction.objectStore('projects').get('existing-project');
        get.onsuccess = () => { expect(get.result).toEqual({ id: 'existing-project' }); database.close(); resolve(); };
        get.onerror = () => reject(get.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
});
