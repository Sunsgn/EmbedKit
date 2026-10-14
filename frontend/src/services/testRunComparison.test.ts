import { describe, expect, it } from 'vitest';
import type { TestRunRecord } from '../types/product';
import { compareTestRuns } from './testRunComparison';

const run = (id: string, status: TestRunRecord['status']): TestRunRecord => ({
  schemaVersion: 2, id, projectId: 'project-1', deviceId: 'device-1', suiteId: 'suite-1', suiteName: 'suite', caseId: 'case-1', caseName: 'case', status, startedAt: '2026-10-14T00:00:00.000Z', finishedAt: '2026-10-14T00:00:01.000Z', durationMs: status === 'passed' ? 800 : 1000, passed: status === 'passed' ? 1 : 0, failed: status === 'passed' ? 0 : 1, agentVersion: '1', firmwareId: 'firmware-1', firmware: { buildId: 'build-1', artifactName: 'app.bin', artifactType: 'bin', size: 1, modifiedAt: '', sha256: 'a'.repeat(64), analyzedAt: '' }, testDefinitionSha256: 'c'.repeat(64), inputEnvironment: {}, secretInputCount: 0, environment: {}, steps: [{ id: 'step-1', name: 'ping', type: 'send', channel: 'tcp', status: status === 'passed' ? 'passed' : 'failed', startedAt: '', finishedAt: '', durationMs: status === 'passed' ? 80 : 100, retries: 0 }], logs: [],
});

describe('test run comparison', () => {
  it('classifies a same-context failed-to-passed rerun as fixed', () => {
    const result = compareTestRuns(run('baseline', 'failed'), run('current', 'passed'));
    expect(result).toMatchObject({ comparable: true, outcome: 'fixed', baselineRunId: 'baseline', currentRunId: 'current', durationDeltaMs: -200, failedDelta: -1 });
    expect(result.steps[0]).toMatchObject({ id: 'step-1', baseline: 'failed', current: 'passed', durationDeltaMs: -20 });
  });

  it('classifies passed-to-failed as a regression', () => {
    expect(compareTestRuns(run('baseline', 'passed'), run('current', 'failed')).outcome).toBe('regressed');
  });

  it('refuses to claim a fix when device, firmware, or case changed', () => {
    const baseline = run('baseline', 'failed'), current = run('current', 'passed');
    current.deviceId = 'device-2';
    current.firmware = { ...current.firmware!, sha256: 'b'.repeat(64) };
    current.caseId = 'case-2';
    const result = compareTestRuns(baseline, current);
    expect(result.outcome).toBe('incomparable');
    expect(result.reasons).toEqual(expect.arrayContaining(['测试套件或用例不同', '设备身份不同', '固件身份或 SHA-256 不同']));
  });

  it('uses the content digest when equivalent firmware has different catalog IDs', () => {
    const baseline = run('baseline', 'failed'), current = run('current', 'passed');
    current.firmwareId = 'firmware-2';
    expect(compareTestRuns(baseline, current).outcome).toBe('fixed');
  });

  it('does not claim a fix when both runs omit device and firmware evidence', () => {
    const baseline = run('baseline', 'failed'), current = run('current', 'passed');
    baseline.deviceId = ''; current.deviceId = '';
    baseline.firmwareId = undefined; current.firmwareId = undefined;
    baseline.firmware = undefined; current.firmware = undefined;
    const result = compareTestRuns(baseline, current);
    expect(result.outcome).toBe('incomparable');
    expect(result.reasons).toEqual(expect.arrayContaining(['缺少设备身份，无法证明使用同一设备', '缺少固件身份或 SHA-256']));
  });

  it('rejects changed test definitions, inputs, and unverifiable secrets', () => {
    const baseline = run('baseline', 'failed'), current = run('current', 'passed');
    current.testDefinitionSha256 = 'd'.repeat(64);
    current.inputEnvironment = { MODE: 'production' };
    current.secretInputCount = 1;
    const result = compareTestRuns(baseline, current);
    expect(result.outcome).toBe('incomparable');
    expect(result.reasons).toEqual(expect.arrayContaining(['测试步骤或参数定义不同', '非秘密输入变量不同', '存在未记录的秘密输入，无法证明输入相同']));
  });

  it('rejects changed communication configuration or Agent version', () => {
    const baseline = run('baseline', 'failed'), current = run('current', 'passed');
    baseline.communications = [{ channel: 'tcp', transport: 'tcp', sessionId: 'old', endpoint: 'client:127.0.0.1:9000', rxBytes: 1, txBytes: 1 }];
    current.communications = [{ channel: 'tcp', transport: 'tcp', sessionId: 'new', endpoint: 'client:127.0.0.1:9001', rxBytes: 1, txBytes: 1 }];
    current.agentVersion = '2';
    const result = compareTestRuns(baseline, current);
    expect(result.outcome).toBe('incomparable');
    expect(result.reasons).toEqual(expect.arrayContaining(['通信通道或端点配置不同', 'Local Agent 版本不同']));
  });
});
