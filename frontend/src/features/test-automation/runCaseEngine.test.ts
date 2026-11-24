import { describe, expect, it, vi } from 'vitest';
import { createTestStep, type FlowVariable, type TestCase } from './domain';
import { runTestCaseEngine, type RunCaseEngineDependencies } from './runCaseEngine';

function dependencies(overrides: Partial<RunCaseEngineDependencies> = {}) {
  let time = Date.parse('2026-01-01T00:00:00.000Z');
  const variables: FlowVariable[] = [];
  return {
    shouldStop: () => false,
    sendData: vi.fn(async () => undefined),
    waitForInput: vi.fn(async () => 'OK'),
    ensureChannel: vi.fn(async () => undefined),
    clearInput: vi.fn(),
    markInputCursor: vi.fn(),
    captureResponse: vi.fn(),
    setVariable: vi.fn((name: string, value: string) => variables.push({ id: name, name, value, secret: false })),
    getVariables: () => variables,
    manualConfirm: vi.fn(async () => true),
    observedInput: vi.fn(() => ''),
    hasInput: vi.fn(() => false),
    sleep: vi.fn(async () => undefined),
    setStatus: vi.fn(),
    setTeardownActive: vi.fn(),
    log: vi.fn(),
    now: () => { time += 10; return time; },
    ...overrides,
  } satisfies RunCaseEngineDependencies;
}

describe('test case execution engine', () => {
  it('stops the main flow after failure but always runs teardown', async () => {
    const failing = { ...createTestStep('wait'), id: 'fail', name: 'wait fails', onFailure: 'stop' as const };
    const testCase: TestCase = { id: 'case', name: 'flow', steps: [
      { ...createTestStep('send'), id: 'setup', stage: 'setup' },
      failing,
      { ...createTestStep('send'), id: 'skipped', stage: 'test' },
      { ...createTestStep('send'), id: 'cleanup', stage: 'teardown' },
    ] };
    const deps = dependencies({ waitForInput: vi.fn(async () => { throw new Error('timeout'); }) });

    const result = await runTestCaseEngine(testCase, deps);

    expect(result).toMatchObject({ passed: 2, failed: 1, aborted: false });
    expect(result.stepRuns.map(step => [step.id, step.status])).toEqual([
      ['setup', 'passed'], ['fail', 'failed'], ['skipped', 'skipped'], ['cleanup', 'passed'],
    ]);
    expect(deps.setTeardownActive).toHaveBeenCalledWith(true);
  });

  it('handles variable assignment, manual evidence and input clearing through explicit ports', async () => {
    const testCase: TestCase = { id: 'case', name: 'flow', steps: [
      { ...createTestStep('set-variable'), id: 'variable', captureName: 'MODE', data: 'loopback' },
      { ...createTestStep('clear-buffer'), id: 'clear' },
      { ...createTestStep('manual'), id: 'manual' },
    ] };
    const deps = dependencies();

    const result = await runTestCaseEngine(testCase, deps);

    expect(result.failed).toBe(0);
    expect(deps.setVariable).toHaveBeenCalledWith('MODE', 'loopback');
    expect(deps.clearInput).toHaveBeenCalledWith('serial-a');
    expect(result.stepRuns.at(-1)?.evidence).toMatchObject({ source: 'manual-confirmation', observed: '操作人员确认通过' });
  });
});
