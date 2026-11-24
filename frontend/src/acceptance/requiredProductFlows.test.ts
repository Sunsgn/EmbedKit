import { describe, expect, it, vi } from 'vitest';
import { summarizeProject } from '../features/project/projectSummary';
import { buildProjectAnalysisReport } from '../features/project/projectAnalysisReport';
import { runTestCaseEngine } from '../features/test-automation/runCaseEngine';
import { createTestStep, type TestCase } from '../features/test-automation/domain';
import { createTestRunEvidence } from '../services/testRunEvidence';
import { createTestRunHtmlReport } from '../features/test-automation/testRunReports';
import type { FileNode } from '../types';
import type { TestRunRecord } from '../types/product';
import { analyzeProjectArchitecture } from '../utils/projectArchitecture';
import { analyzeCanFrame, analyzeBinary, calculateAdc, calculateTimerPwm, parseIntelHex } from '../utils/embeddedTools';
import { toolRegistry } from '../tools/registry';
import { navSections } from '../appNavigation';

describe('required product acceptance flows', () => {
  it('analyzes an unfamiliar project from source evidence through navigable findings and report', () => {
    const files: FileNode[] = [
      { name: 'main.c', path: '/src/main.c', language: 'c', content: 'void board_init(void);\nvoid service_poll(void);\nint main(void) { board_init(); for (;;) { service_poll(); } }' },
      { name: 'service.c', path: '/src/service.c', language: 'c', content: 'void service_poll(void) { /* TODO: bound queue processing */ }' },
      { name: 'Makefile', path: '/Makefile', language: 'makefile', content: 'all:\n\t$(CC) src/main.c src/service.c' },
    ];
    const summary = summarizeProject(files);
    const architecture = analyzeProjectArchitecture(files);
    const report = buildProjectAnalysisReport({ projectName: 'unfamiliar-fixture', generatedAt: '2026-01-01T00:00:00.000Z', summary, architecture, behavior: null, runtimeTrace: null, mapAnalysis: null });

    expect(summary.toolchain).toContain('Make');
    expect(summary.chip).toContain('未识别');
    expect(architecture.runtime).toContain('裸机');
    expect(architecture.flows[0].steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'main', file: '/src/main.c', line: 2 }),
      expect.objectContaining({ name: 'service_poll', file: '/src/service.c', line: 1, control: 'loop' }),
    ]));
    expect(summary.findings).toEqual(expect.arrayContaining([expect.objectContaining({ file: '/src/service.c', line: 1, recommendation: expect.any(String) })]));
    expect(report).toContain('## 程序执行流程');
    expect(report).toContain('/src/service.c:1');
    expect(report).toContain('能力边界');
  });

  it('runs a multi-step virtual-device flow and exports the failed step with raw session evidence', async () => {
    const testCase: TestCase = { id: 'case', name: 'virtual device flow', steps: [
      { ...createTestStep('send'), id: 'connect', name: 'connect', stage: 'setup', data: 'OPEN' },
      { ...createTestStep('command'), id: 'query', name: 'query status', expected: 'OK', retryCount: 0, onFailure: 'continue' },
      { ...createTestStep('send'), id: 'cleanup', name: 'close', stage: 'teardown', data: 'CLOSE' },
    ] };
    const sent: string[] = [], statuses: Record<string, string> = {};
    const result = await runTestCaseEngine(testCase, {
      shouldStop: () => false,
      sendData: async step => { sent.push(step.data); },
      waitForInput: async () => { throw new Error('device returned ERROR'); },
      ensureChannel: async () => undefined,
      clearInput: vi.fn(), markInputCursor: vi.fn(), captureResponse: vi.fn(), setVariable: vi.fn(), getVariables: () => [],
      manualConfirm: async () => true, observedInput: () => '45 52 52 4F 52', hasInput: () => true,
      sleep: async () => undefined, setStatus: (id, status) => { statuses[id] = status; }, setTeardownActive: vi.fn(), log: vi.fn(),
    });
    const run = createTestRunEvidence({
      schemaVersion: 3, id: 'run-virtual', suiteId: 'suite', suiteName: 'acceptance', caseId: testCase.id, caseName: testCase.name,
      status: 'failed', startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:00:01.000Z', durationMs: 1000,
      passed: result.passed, failed: result.failed, agentVersion: 'virtual-1', environment: {}, steps: result.stepRuns, logs: [],
      communications: [{ channel: 'serial-a', transport: 'serial', sessionId: 'virtual-session', endpoint: 'virtual://loopback', rxBytes: 5, txBytes: 9 }], communicationSessionIds: ['archive-virtual-session'],
    } satisfies TestRunRecord);
    const report = createTestRunHtmlReport(run);

    expect(sent).toEqual(['OPEN', 'AT', 'CLOSE']);
    expect(statuses).toMatchObject({ connect: 'passed', query: 'failed', cleanup: 'passed' });
    expect(run.steps.find(step => step.id === 'query')).toMatchObject({ status: 'failed', error: 'device returned ERROR', evidence: { source: 'device-response', observed: '45 52 52 4F 52' } });
    expect(report).toContain('virtual://loopback');
    expect(report).toContain('archive-virtual-session');
  });

  it('keeps communication and deterministic tools independently reachable without a project', () => {
    const routes = navSections.flatMap(group => group.items.map(item => item.path));
    expect(routes).toEqual(expect.arrayContaining(['/communication', '/toolbox']));
    const requiredTools = ['can', 'timer', 'adc', 'ihex', 'bin', 'elf', 'map'];
    expect(requiredTools.every(id => toolRegistry.some(tool => tool.id === id))).toBe(true);
    expect(toolRegistry.filter(tool => requiredTools.includes(tool.id) && tool.id !== 'elf').every(tool => !tool.requiresAgent)).toBe(true);
    expect(analyzeCanFrame('123', false, '01 02')).toMatchObject({ id: 0x123, dlc: 2 });
    expect(calculateTimerPwm(72_000_000, 71, 999, 250).frequencyHz).toBe(1000);
    expect(calculateAdc(12, 3.3, 2048).pinVoltage).toBeCloseTo(1.6504, 3);
    expect(parseIntelHex(':020000040800F2\n:0400000001020304F2\n:00000001FF').binary).toEqual(Uint8Array.from([1, 2, 3, 4]));
    expect(analyzeBinary(Uint8Array.from([0xff, 0, 1, 2])).size).toBe(4);
  });
});
