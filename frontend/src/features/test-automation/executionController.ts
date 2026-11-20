import { canRetryStep, normalizeRetryPolicy, retryTimeRemaining } from '../../utils/testRetryPolicy';
import type { TestStep } from './domain';

export interface RetryExecutionHooks {
  shouldStop: () => boolean;
  sleep: (milliseconds: number) => Promise<unknown>;
  now?: () => number;
  onAttempt?: (attempt: number) => void;
  onRetry?: (event: { failedAttempt: number; nextAttempt: number; delayMs: number; error: unknown }) => void;
  onTimeLimit?: (limitMs: number) => void;
}

export interface RetryExecutionResult<T> { value: T; attempts: number; elapsedMs: number }

export async function executeStepWithRetry<T>(step: TestStep, action: (attempt: number) => Promise<T>, hooks: RetryExecutionHooks): Promise<RetryExecutionResult<T>> {
  const policy = normalizeRetryPolicy(step), now = hooks.now ?? Date.now, started = now();
  let lastError: unknown;
  for (let attempt = 0; attempt <= policy.retryCount; attempt += 1) {
    const elapsedBeforeAttempt = now() - started;
    if (attempt > 0 && policy.retryTimeLimitMs > 0 && elapsedBeforeAttempt >= policy.retryTimeLimitMs) {
      hooks.onTimeLimit?.(policy.retryTimeLimitMs);
      throw lastError;
    }
    try {
      hooks.onAttempt?.(attempt);
      const value = await action(attempt);
      return { value, attempts: attempt, elapsedMs: now() - started };
    } catch (reason) {
      lastError = reason;
      if (hooks.shouldStop()) throw reason;
      const elapsedMs = now() - started;
      if (!canRetryStep(policy, attempt, elapsedMs)) {
        if (attempt < policy.retryCount && policy.retryTimeLimitMs > 0) hooks.onTimeLimit?.(policy.retryTimeLimitMs);
        throw reason;
      }
      const delayMs = Math.min(policy.retryDelayMs, retryTimeRemaining(policy, elapsedMs));
      hooks.onRetry?.({ failedAttempt: attempt, nextAttempt: attempt + 1, delayMs, error: reason });
      for (let waited = 0; waited < delayMs;) {
        if (hooks.shouldStop()) throw reason;
        const slice = Math.min(100, delayMs - waited);
        await hooks.sleep(slice);
        waited += slice;
      }
    }
  }
  throw lastError;
}
