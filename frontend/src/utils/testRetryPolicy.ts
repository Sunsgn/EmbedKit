export const MAX_RETRY_COUNT = 1_000;
export const MAX_RETRY_DELAY_MS = 60 * 60 * 1_000;
export const MAX_RETRY_TIME_LIMIT_MS = 24 * 60 * 60 * 1_000;

const boundedInteger = (value: unknown, maximum: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(maximum, Math.trunc(numeric)));
};

export interface RetryPolicyInput {
  retryCount?: number;
  retryDelayMs?: number;
  retryTimeLimitMs?: number;
}

export interface NormalizedRetryPolicy {
  retryCount: number;
  retryDelayMs: number;
  retryTimeLimitMs: number;
}

export const normalizeRetryPolicy = (
  input: RetryPolicyInput,
): NormalizedRetryPolicy => ({
  retryCount: boundedInteger(input.retryCount, MAX_RETRY_COUNT),
  retryDelayMs: boundedInteger(input.retryDelayMs, MAX_RETRY_DELAY_MS),
  retryTimeLimitMs: boundedInteger(
    input.retryTimeLimitMs,
    MAX_RETRY_TIME_LIMIT_MS,
  ),
});

export const retryTimeRemaining = (
  policy: NormalizedRetryPolicy,
  elapsedMs: number,
) =>
  policy.retryTimeLimitMs === 0
    ? Number.POSITIVE_INFINITY
    : Math.max(0, policy.retryTimeLimitMs - Math.max(0, elapsedMs));

export const canRetryStep = (
  policy: NormalizedRetryPolicy,
  failedAttemptIndex: number,
  elapsedMs: number,
) =>
  failedAttemptIndex < policy.retryCount &&
  retryTimeRemaining(policy, elapsedMs) > 0;
