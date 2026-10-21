import { describe, expect, it } from "vitest";
import {
  MAX_RETRY_COUNT,
  MAX_RETRY_DELAY_MS,
  MAX_RETRY_TIME_LIMIT_MS,
  canRetryStep,
  normalizeRetryPolicy,
  retryTimeRemaining,
} from "./testRetryPolicy";

describe("test retry policy", () => {
  it("allows retry counts above the old ten retry limit", () => {
    const policy = normalizeRetryPolicy({ retryCount: 200 });
    expect(policy.retryCount).toBe(200);
    expect(canRetryStep(policy, 10, 1_000)).toBe(true);
    expect(canRetryStep(policy, 200, 1_000)).toBe(false);
  });

  it("bounds imported or manually edited values", () => {
    expect(
      normalizeRetryPolicy({
        retryCount: 9_999,
        retryDelayMs: Number.POSITIVE_INFINITY,
        retryTimeLimitMs: 99 * 60 * 60 * 1_000,
      }),
    ).toEqual({
      retryCount: MAX_RETRY_COUNT,
      retryDelayMs: 0,
      retryTimeLimitMs: MAX_RETRY_TIME_LIMIT_MS,
    });
    expect(normalizeRetryPolicy({ retryCount: -1 })).toEqual({
      retryCount: 0,
      retryDelayMs: 0,
      retryTimeLimitMs: 0,
    });
    expect(MAX_RETRY_DELAY_MS).toBe(3_600_000);
  });

  it("stops at the total retry duration while zero keeps the count-only mode", () => {
    const timed = normalizeRetryPolicy({ retryCount: 100, retryTimeLimitMs: 60_000 });
    expect(retryTimeRemaining(timed, 59_000)).toBe(1_000);
    expect(canRetryStep(timed, 5, 60_000)).toBe(false);

    const legacy = normalizeRetryPolicy({ retryCount: 20 });
    expect(retryTimeRemaining(legacy, 999_999)).toBe(Number.POSITIVE_INFINITY);
    expect(canRetryStep(legacy, 19, 999_999)).toBe(true);
  });
});
