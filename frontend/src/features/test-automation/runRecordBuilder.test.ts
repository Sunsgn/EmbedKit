import { describe, expect, it } from 'vitest';
import { buildTestRunRecord } from './runRecordBuilder';

describe('test run record builder', () => {
  it('assembles traceable records and archives while redacting secret values', () => {
    const { record, communicationSessions } = buildTestRunRecord({
      runId: 'run-1', suite: { id: 'suite', name: 'suite', cases: [] }, testCase: { id: 'case', name: 'case', steps: [] }, status: 'failed',
      startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:00:01.000Z', durationMs: 1000, passed: 0, failed: 1, agentVersion: '1.0.0',
      firmware: { firmwareId: 'firmware-1', buildId: 'build-1', fileName: 'app.bin', artifactType: 'bin', size: 4, modifiedAt: '2026-01-01T00:00:00.000Z', sha256: 'a'.repeat(64), analyzedAt: '2026-01-01T00:00:00.000Z' },
      communicationEvidence: [{ channel: 'serial-a', transport: 'serial', sessionId: 'session-1', endpoint: 'COM7', rxBytes: 5, txBytes: 2, startedAt: '2026-01-01T00:00:00.000Z' }],
      testDefinitionSha256: 'b'.repeat(64), inputEnvironment: { MODE: 'test' }, secretInputCount: 1,
      runtimeVariables: [{ id: 'token', name: 'TOKEN', value: 'secret-value', secret: true }, { id: 'mode', name: 'MODE', value: 'test', secret: false }],
      steps: [{ id: 'step', name: 'query secret-value', type: 'command', channel: 'serial-a', status: 'failed', startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:00:01.000Z', durationMs: 1000, retries: 0, error: 'secret-value rejected' }],
      logs: [{ id: 1, time: '00:00:01', level: 'fail', text: 'secret-value rejected' }],
    });
    expect(record).toMatchObject({ id: 'run-1', firmwareId: 'firmware-1', environment: { MODE: 'test' }, communicationSessionIds: [expect.any(String)] });
    expect(record.steps[0].error).toBe('[REDACTED] rejected');
    expect(record.logs[0].text).toBe('[REDACTED] rejected');
    expect(communicationSessions[0]).toMatchObject({ id: 'run-1:serial-a', sourceSessionId: 'session-1', endpoint: 'COM7' });
  });
});
