import { describe, expect, it, vi } from 'vitest';
import { createTestStep } from './domain';
import { executeStepWithRetry } from './executionController';

describe('test execution retry controller', () => {
  it('repeats the complete action and reports zero-based retry evidence', async () => {
    let calls = 0, clock = 0;
    const onRetry = vi.fn(), step = { ...createTestStep(), retryCount: 2, retryDelayMs: 100 };
    const result = await executeStepWithRetry(step, async () => { calls += 1; if (calls < 3) throw new Error('temporary'); return 'OK'; }, { shouldStop: () => false, now: () => clock, sleep: async milliseconds => { clock += milliseconds; }, onRetry });
    expect(result).toMatchObject({ value: 'OK', attempts: 2, elapsedMs: 200 });
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('honors the total time limit and remains cancellable during delay', async () => {
    let clock = 0, stopped = false;
    const step = { ...createTestStep(), retryCount: 5, retryDelayMs: 1000, retryTimeLimitMs: 250 };
    const onTimeLimit = vi.fn();
    await expect(executeStepWithRetry(step, async () => { throw new Error('still failing'); }, { shouldStop: () => stopped, now: () => clock, sleep: async milliseconds => { clock += milliseconds; if (clock >= 200) stopped = true; }, onTimeLimit })).rejects.toThrow('still failing');
    expect(clock).toBe(200);
    expect(onTimeLimit).not.toHaveBeenCalled();
  });
});
