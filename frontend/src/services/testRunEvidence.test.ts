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
    const value = run();
    value.evidenceReferences = [{
      schemaVersion: 1,
      id: 'evidence-1',
      kind: 'log',
      origin: 'captured',
      sourceId: 'run-1',
      label: 'password-123 response',
    }];
    value.findings = [{
      schemaVersion: 1,
      id: 'finding-1',
      category: 'communication',
      severity: 'error',
      conclusionType: 'deterministic',
      confidence: 'high',
      summary: 'password-123 failed',
      evidenceIds: ['evidence-1'],
      unknowns: ['password-123 state'],
      verificationSteps: ['retry password-123'],
    }];
    const result = createTestRunEvidence(value, ['password-123']);

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

  it('normalizes versioned common evidence without changing legacy step evidence', () => {
    const value = run();
    value.evidenceReferences = [
      {
        schemaVersion: 1,
        id: 'rx-1',
        kind: 'communication',
        origin: 'captured',
        sourceId: 'session-1',
        label: '设备响应',
        location: { eventId: 'event-1' },
      },
    ];
    value.findings = [
      {
        schemaVersion: 1,
        id: 'timeout-1',
        category: 'communication',
        severity: 'error',
        conclusionType: 'deterministic',
        confidence: 'high',
        summary: '等待响应超时',
        evidenceIds: ['rx-1'],
        unknowns: [],
        verificationSteps: ['检查设备是否仍在线'],
      },
    ];

    const result = normalizeTestRunRecord(value);

    expect(result.evidenceReferences?.[0].location?.eventId).toBe('event-1');
    expect(result.findings?.[0].conclusionType).toBe('deterministic');
    expect(result.steps[0].evidence?.source).toBe('device-response');
  });

  it('keeps only valid stable lifecycle relationships', () => {
    const value = run();
    value.projectRevisionId = 'revision-1';
    value.firmwareId = '../invalid';
    value.baselineRunId = 'baseline-1';
    value.communicationSessionIds = ['session-1', 'session-1', '../invalid'];

    const result = normalizeTestRunRecord(value);

    expect(result.projectRevisionId).toBe('revision-1');
    expect(result.firmwareId).toBeUndefined();
    expect(result.baselineRunId).toBe('baseline-1');
    expect(result.communicationSessionIds).toEqual(['session-1']);
  });
});
