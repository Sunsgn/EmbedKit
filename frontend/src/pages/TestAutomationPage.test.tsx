import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TestAutomationPage from './TestAutomationPage';
import { getAgentStatus } from '../services/agentClient';
import { closeNetworkSession, openNetworkSession, sendNetworkData } from '../services/networkAgent';
import { listSerialSessions } from '../services/serialAgent';
import { listBuildArtifacts, listFirmwareIdentities, listTestRuns, saveTestRunWithCommunicationSessions } from '../services/productStorage';
import { createConfigurationFingerprint } from '../services/configurationFingerprint';

vi.mock('../services/agentClient', () => ({ getAgentStatus: vi.fn() }));
vi.mock('../services/networkAgent', () => ({ closeNetworkSession: vi.fn(), openNetworkSession: vi.fn(), readNetworkSession: vi.fn(), sendNetworkData: vi.fn() }));
vi.mock('../services/serialAgent', () => ({ listSerialSessions: vi.fn(), readSerialSession: vi.fn(), sendSerialData: vi.fn() }));
vi.mock('../services/productStorage', () => ({ deleteTestRun: vi.fn(), listBuildArtifacts: vi.fn(), listFirmwareIdentities: vi.fn(), listTestRuns: vi.fn(), saveTestRunWithCommunicationSessions: vi.fn() }));

const tcpSuite = [{
  id: 'suite-1',
  name: 'TCP 设备流程',
  variables: [],
  cases: [{
    id: 'case-1',
    name: '发送与清理',
    sharedChannel: true,
    channel: 'tcp',
    lineEnding: 'none',
    steps: [{ id: 'step-1', name: '发送 PING', type: 'send', stage: 'test', channel: 'tcp', data: 'PING', hex: false, durationMs: 0, timeoutMs: 1000, retryCount: 0, matchMode: 'contains', expected: '', failurePattern: '', onFailure: 'stop' }],
  }],
}];

describe('TestAutomationPage centralized Agent workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('embedkit.automation.suites', JSON.stringify(tcpSuite));
    vi.mocked(getAgentStatus).mockResolvedValue({ available: true, name: 'EmbedKit Local Agent', version: '1.0.0', protocolVersion: 1, uptimeSeconds: 1, capabilities: ['tcp-client'], serialSessions: 0, networkSessions: 0, buildJobs: 0 });
    vi.mocked(listSerialSessions).mockResolvedValue([]);
    vi.mocked(listTestRuns).mockResolvedValue([]);
    vi.mocked(listBuildArtifacts).mockResolvedValue([]);
    vi.mocked(listFirmwareIdentities).mockResolvedValue([]);
    vi.mocked(saveTestRunWithCommunicationSessions).mockImplementation(async (run) => run);
    vi.mocked(openNetworkSession).mockResolvedValue({ id: 'network-1', type: 'tcp', mode: 'client', host: '127.0.0.1', port: 9000, localAddress: '127.0.0.1:50000', state: 'connected', rxBytes: 0, txBytes: 0, events: [] });
    vi.mocked(sendNetworkData).mockResolvedValue({ sent: 4 });
    vi.mocked(closeNetworkSession).mockResolvedValue({ closed: true });
  });

  it('runs a TCP flow, records evidence, and releases the Agent session', async () => {
    render(<TestAutomationPage />);
    await waitFor(() => expect(getAgentStatus).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: '运行流程' }));

    await waitFor(() => expect(openNetworkSession).toHaveBeenCalledWith({ type: 'tcp', mode: 'client', host: '127.0.0.1', port: 9000, localPort: 0 }));
    expect(sendNetworkData).toHaveBeenCalledWith('network-1', 'PING', 'text');
    await waitFor(() => expect(closeNetworkSession).toHaveBeenCalledWith('network-1'));
    await waitFor(() => expect(saveTestRunWithCommunicationSessions).toHaveBeenCalledWith(expect.objectContaining({ schemaVersion: 3, caseName: '发送与清理', status: 'passed', agentVersion: '1.0.0', passed: 1, failed: 0, communications: [expect.objectContaining({ transport: 'tcp', sessionId: 'network-1', txBytes: 4, rxBytes: 0 })], communicationSessionIds: [expect.stringMatching(/:tcp$/)] }), [expect.objectContaining({ sourceSessionId: 'network-1', transport: 'tcp', status: 'completed', txBytes: 4, rxBytes: 0 })]));
    expect(screen.getByText(/测试创建的网络资源已释放/)).toBeVisible();
  });

  it('links a rerun to its baseline and reports a same-context candidate fix', async () => {
    const testDefinitionSha256 = await createConfigurationFingerprint(tcpSuite[0].cases[0]);
    vi.mocked(listBuildArtifacts).mockResolvedValue([{ schemaVersion: 1, id: 'artifact-1', buildId: 'build-1', kind: 'bin', fileName: 'verified.bin', byteLength: 64, sha256: 'b'.repeat(64), capturedAt: '2026-10-14T00:00:00.000Z' }]);
    vi.mocked(listFirmwareIdentities).mockResolvedValue([{ schemaVersion: 1, id: 'firmware-1', buildArtifactId: 'artifact-1', sha256: 'b'.repeat(64), byteLength: 64, format: 'bin', capturedAt: '2026-10-14T00:00:00.000Z' }]);
    vi.mocked(listTestRuns).mockResolvedValue([{ schemaVersion: 3, id: 'baseline-1', suiteId: 'suite-1', suiteName: 'TCP 设备流程', caseId: 'case-1', caseName: '发送与清理', status: 'failed', startedAt: '2026-10-13T00:00:00.000Z', finishedAt: '2026-10-13T00:00:01.000Z', durationMs: 1000, passed: 0, failed: 1, agentVersion: '1.0.0', firmwareId: 'firmware-1', firmware: { buildId: 'build-1', artifactName: 'verified.bin', artifactType: 'bin', size: 64, modifiedAt: '', sha256: 'b'.repeat(64), analyzedAt: '' }, testDefinitionSha256, inputEnvironment: {}, secretInputCount: 0, communications: [{ channel: 'tcp', transport: 'tcp', sessionId: 'old-network', endpoint: 'client:127.0.0.1:9000', rxBytes: 0, txBytes: 4 }], environment: {}, steps: [{ id: 'step-1', name: '发送 PING', type: 'send', channel: 'tcp', status: 'failed', startedAt: '', finishedAt: '', durationMs: 1000, retries: 0 }], logs: [] }]);
    render(<TestAutomationPage />);
    await waitFor(() => expect(screen.getByRole('option', { name: /failed/ })).toBeVisible());
    fireEvent.change(screen.getByLabelText('已计算固件指纹'), { target: { value: 'firmware-1' } });
    fireEvent.change(screen.getByLabelText('修复复测基线'), { target: { value: 'baseline-1' } });
    fireEvent.click(screen.getByRole('button', { name: '运行流程' }));

    await waitFor(() => expect(saveTestRunWithCommunicationSessions).toHaveBeenCalledWith(expect.objectContaining({ baselineRunId: 'baseline-1', status: 'passed' }), expect.any(Array)));
    fireEvent.click(screen.getByRole('button', { name: '执行日志' }));
    expect(await screen.findByText('复测通过，候选修复有效')).toBeVisible();
  });

  it('keeps flow editing available when the Agent is offline', async () => {
    vi.mocked(getAgentStatus).mockRejectedValue(new Error('offline'));
    render(<TestAutomationPage />);
    await waitFor(() => expect(getAgentStatus).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: '运行流程' })).toBeEnabled();
    expect(screen.getByText('发送 PING')).toBeVisible();
  });

  it('optionally snapshots a real firmware fingerprint without a project or device relation', async () => {
    localStorage.setItem(
      'embedkit.build-analysis-records',
      JSON.stringify([
        {
          schemaVersion: 1,
          id: 'build-1:0',
          buildId: 'build-1',
          artifactIndex: 0,
          fileName: 'release.bin',
          artifactType: 'bin',
          size: 128,
          modifiedAt: '2026-10-12T00:00:00.000Z',
          sha256: 'a'.repeat(64),
          kind: 'bin',
          status: 'passed',
          analyzedAt: '2026-10-12T00:01:00.000Z',
        },
      ]),
    );
    render(<TestAutomationPage />);
    await waitFor(() => expect(screen.getByRole('option', { name: /release\.bin/ })).toBeVisible());
    fireEvent.change(screen.getByLabelText('已计算固件指纹'), {
      target: { value: 'build-1:0' },
    });
    fireEvent.click(screen.getByRole('button', { name: '运行流程' }));

    await waitFor(() =>
      expect(saveTestRunWithCommunicationSessions).toHaveBeenCalledWith(
        expect.objectContaining({
          firmware: expect.objectContaining({
            buildId: 'build-1',
            artifactName: 'release.bin',
            sha256: 'a'.repeat(64),
          }),
        }),
        expect.any(Array),
      ),
    );
  });

  it('associates a persisted firmware identity with a test run', async () => {
    vi.mocked(listBuildArtifacts).mockResolvedValue([{ schemaVersion: 1, id: 'artifact-1', buildId: 'build-2', kind: 'bin', fileName: 'verified.bin', byteLength: 64, sha256: 'b'.repeat(64), capturedAt: '2026-10-14T00:00:00.000Z' }]);
    vi.mocked(listFirmwareIdentities).mockResolvedValue([{ schemaVersion: 1, id: 'firmware-1', buildArtifactId: 'artifact-1', sha256: 'b'.repeat(64), byteLength: 64, format: 'bin', capturedAt: '2026-10-14T00:00:00.000Z' }]);

    render(<TestAutomationPage />);
    await waitFor(() => expect(screen.getByRole('option', { name: /verified\.bin/ })).toBeVisible());
    fireEvent.change(screen.getByLabelText('已计算固件指纹'), { target: { value: 'firmware-1' } });
    fireEvent.click(screen.getByRole('button', { name: '运行流程' }));

    await waitFor(() => expect(saveTestRunWithCommunicationSessions).toHaveBeenCalledWith(expect.objectContaining({ firmwareId: 'firmware-1', firmware: expect.objectContaining({ artifactName: 'verified.bin', sha256: 'b'.repeat(64) }) }), [expect.objectContaining({ firmwareId: 'firmware-1' })]));
  });

  it('does not offer a legacy firmware record with an invalid digest', async () => {
    localStorage.setItem('embedkit.build-analysis-records', JSON.stringify([{ schemaVersion: 1, id: 'bad:0', buildId: 'bad', artifactIndex: 0, fileName: 'unverified.bin', artifactType: 'bin', size: 1, modifiedAt: '2026-10-14T00:00:00.000Z', sha256: 'abc123', kind: 'bin', status: 'passed', analyzedAt: '2026-10-14T00:00:00.000Z' }]));
    render(<TestAutomationPage />);
    await waitFor(() => expect(listFirmwareIdentities).toHaveBeenCalled());
    expect(screen.queryByRole('option', { name: /unverified\.bin/ })).not.toBeInTheDocument();
  });
});
