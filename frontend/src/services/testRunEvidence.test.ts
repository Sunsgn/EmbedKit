import { describe, expect, it } from 'vitest';
import type { TestRunRecord } from '../types/product';
import {
  createTestRunEvidence,
  createTestRunJsonReport,
  normalizeTestRunRecord,
  TEST_RUN_LOG_LIMIT,
  TEST_RUN_OBSERVED_LIMIT,
} from './testRunEvidence';

const run = (): TestRunRecord => ({
  id: 'run-1',
  projectId: '',
  deviceId: '',
  suiteId: 'suite-1',
  suiteName: '联网验收',
  caseId: 'case-1',
  caseName: 'AT 联网流程',
  status: 'failed',
  startedAt: '2026-10-12T00:00:00.000Z',
  finishedAt: '2026-10-12T00:00:01.000Z',
  durationMs: 1000,
  passed: 0,
  failed: 1,
  agentVersion: '1.0.0',
  environment: { DEVICE_IP: '192.0.2.1' },
  steps: [
    {
      id: 'step-1',
      name: '连接 Wi-Fi',
      type: 'command',
      channel: 'serial-a',
      status: 'failed',
      startedAt: '2026-10-12T00:00:00.000Z',
      finishedAt: '2026-10-12T00:00:01.000Z',
      durationMs: 1000,
      retries: 2,
      error: 'password-123 failed',
      evidence: {
        source: 'device-response',
        expected: 'OK',
        observed: `password-123${'x'.repeat(TEST_RUN_OBSERVED_LIMIT + 100)}`,
        timeoutMs: 1000,
      },
    },
  ],
  logs: Array.from({ length: TEST_RUN_LOG_LIMIT + 5 }, (_, index) => ({
    time: String(index),
    level: 'rx',
    text: `response password-123 ${index}`,
  })),
});

describe('test run evidence', () => {
  it('redacts secret variables and enforces evidence bounds', () => {
    const result = createTestRunEvidence(run(), ['password-123']);

    expect(result.schemaVersion).toBe(2);
    expect(result.logs).toHaveLength(TEST_RUN_LOG_LIMIT);
    expect(JSON.stringify(result)).not.toContain('password-123');
    expect((result.steps[0].evidence?.observed ?? '').length).toBeLessThanOrEqual(
      TEST_RUN_OBSERVED_LIMIT,
    );
  });

  it('keeps legacy records readable without inventing associations', () => {
    const legacy = run();
    const result = normalizeTestRunRecord(legacy);

    expect(result.schemaVersion).toBeUndefined();
    expect(result.device).toBeUndefined();
    expect(result.firmware).toBeUndefined();
    expect(result.communications).toBeUndefined();
  });

  it('labels automatic, manual, and configuration evidence in JSON reports', () => {
    const report = createTestRunJsonReport(run());

    expect(report.schema).toBe('embedkit.real-device-test-report');
    expect(report.evidenceLegend.manualConfirmation).toContain('不等价');
  });
});
