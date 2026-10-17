import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TestAutomationPage from './TestAutomationPage';
import { getAgentStatus } from '../services/agentClient';
import { closeNetworkSession, openNetworkSession, sendNetworkData } from '../services/networkAgent';
import { closeSerialSession, listSerialPorts, listSerialSessions, openSerialSession, readSerialSession, sendSerialData } from '../services/serialAgent';
import { listBuildArtifacts, listFirmwareIdentities, listTestRuns, saveTestRunWithCommunicationSessions } from '../services/productStorage';
import { createConfigurationFingerprint } from '../services/configurationFingerprint';
import { writeSerialTestSessionHandoff } from '../services/testSessionHandoff';

vi.mock('../services/agentClient', () => ({ getAgentStatus: vi.fn() }));
vi.mock('../services/networkAgent', () => ({ closeNetworkSession: vi.fn(), openNetworkSession: vi.fn(), readNetworkSession: vi.fn(), sendNetworkData: vi.fn() }));
vi.mock('../services/serialAgent', () => ({ closeSerialSession: vi.fn(), listSerialPorts: vi.fn(), listSerialSessions: vi.fn(), openSerialSession: vi.fn(), readSerialSession: vi.fn(), sendSerialData: vi.fn() }));
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
const serialSuite = [{
  id: 'suite-serial', name: '真实串口流程', variables: [], cases: [{
    id: 'case-serial', name: '串口发送', sharedChannel: true, channel: 'serial-a', lineEnding: 'none',
    steps: [{ id: 'step-serial', name: '发送 PING', type: 'send', stage: 'test', channel: 'serial-a', data: 'PING', hex: false, durationMs: 0, timeoutMs: 1000, retryCount: 0, matchMode: 'contains', expected: '', failurePattern: '', onFailure: 'stop' }],
  }],
}];

describe('TestAutomationPage centralized Agent workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    window.location.hash = '';
    localStorage.setItem('embedkit.automation.suites', JSON.stringify(tcpSuite));
    vi.mocked(getAgentStatus).mockResolvedValue({ available: true, name: 'EmbedKit Local Agent', version: '1.0.0', protocolVersion: 1, uptimeSeconds: 1, capabilities: ['tcp-client'], serialSessions: 0, networkSessions: 0, buildJobs: 0 });
    vi.mocked(listSerialPorts).mockResolvedValue([]);
    vi.mocked(listSerialSessions).mockResolvedValue([]);
    vi.mocked(readSerialSession).mockResolvedValue({ id: 'serial-1', path: 'COM7', baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', dtr: false, rts: false, state: 'connected', rxBytes: 0, txBytes: 0, openedAt: '', events: [] });
    vi.mocked(sendSerialData).mockResolvedValue({ sent: 4 });
    vi.mocked(closeSerialSession).mockResolvedValue({ closed: true });
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

  it('overrides the case line ending for one text send step and persists the choice', async () => {
    render(<TestAutomationPage />);
    const lineEnding = screen.getByLabelText('步骤发送行尾');
    expect(lineEnding).toHaveValue('inherit');

    fireEvent.change(lineEnding, { target: { value: 'crlf' } });
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('embedkit.automation.suites') ?? '[]');
      expect(saved[0].cases[0].steps[0].lineEnding).toBe('crlf');
    });
    fireEvent.click(screen.getByRole('button', { name: '运行流程' }));

    await waitFor(() => expect(sendNetworkData).toHaveBeenCalledWith('network-1', 'PING\r\n', 'text'));
    await waitFor(() => expect(saveTestRunWithCommunicationSessions).toHaveBeenCalledWith(expect.objectContaining({ communications: [expect.objectContaining({ txBytes: 6 })] }), expect.any(Array)));
  });

  it('never appends a configured line ending to an explicit HEX step', async () => {
    const suite = [{ ...tcpSuite[0], cases: [{ ...tcpSuite[0].cases[0], lineEnding: 'crlf', steps: [{ ...tcpSuite[0].cases[0].steps[0], data: '50 49 4E 47', hex: true, lineEnding: 'lf' }] }] }];
    localStorage.setItem('embedkit.automation.suites', JSON.stringify(suite));

    render(<TestAutomationPage />);
    expect(screen.getByLabelText('步骤发送行尾')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '运行流程' }));

    await waitFor(() => expect(sendNetworkData).toHaveBeenCalledWith('network-1', '50 49 4E 47', 'hex'));
    await waitFor(() => expect(saveTestRunWithCommunicationSessions).toHaveBeenCalledWith(expect.objectContaining({ communications: [expect.objectContaining({ txBytes: 4 })] }), expect.any(Array)));
  });

  it('keeps secondary step and flow settings collapsed until requested', () => {
    render(<TestAutomationPage />);

    expect(screen.getByLabelText('步骤发送行尾')).toBeVisible();
    expect(screen.getByLabelText('步骤名称')).not.toBeVisible();
    fireEvent.click(screen.getByText(/基础属性 ·/));
    expect(screen.getByLabelText('步骤名称')).toBeVisible();

    expect(screen.getByLabelText('默认发送行尾')).not.toBeVisible();
    fireEvent.click(screen.getByText(/流程默认值 ·/));
    expect(screen.getByLabelText('默认发送行尾')).toBeVisible();
  });

  it('hides command failure matching and capture fields behind advanced settings', () => {
    localStorage.removeItem('embedkit.automation.suites');
    render(<TestAutomationPage />);

    expect(screen.getByLabelText('指令发送行尾')).toBeVisible();
    expect(screen.getByLabelText('失败响应（正则）')).not.toBeVisible();
    fireEvent.click(screen.getByText(/高级断言与响应提取/));
    expect(screen.getByLabelText('失败响应（正则）')).toBeVisible();
  });

  it('selects and opens a real serial port inside the test page, then closes the owned session', async () => {
    localStorage.setItem('embedkit.automation.suites', JSON.stringify(serialSuite));
    vi.mocked(listSerialPorts).mockResolvedValue([{ path: 'COM7', manufacturer: 'FTDI', serialNumber: 'A1', vendorId: '0403', productId: '6001', pnpId: '', friendlyName: 'USB Serial Port' }]);
    vi.mocked(openSerialSession).mockResolvedValue({ id: 'serial-1', path: 'COM7', baudRate: 230400, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', dtr: false, rts: false, state: 'connected', rxBytes: 0, txBytes: 0, openedAt: '', events: [], reused: false });

    render(<TestAutomationPage />);
    expect(screen.queryByLabelText('串口 A真实串口')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '新建或复用连接' })[0]);
    await waitFor(() => expect(within(screen.getByLabelText('串口 A真实串口')).getByRole('option', { name: /COM7.*USB Serial Port/ })).toBeVisible());
    fireEvent.change(screen.getByLabelText('串口 A波特率'), { target: { value: '230400' } });
    fireEvent.click(screen.getByRole('button', { name: '连接串口 A' }));

    await waitFor(() => expect(openSerialSession).toHaveBeenCalledWith({ path: 'COM7', baudRate: 230400, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' }));
    expect(await screen.findByText(/本页创建，测试结束自动关闭/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '运行流程' }));
    await waitFor(() => expect(sendSerialData).toHaveBeenCalledWith('serial-1', 'PING', 'text'));
    await waitFor(() => expect(closeSerialSession).toHaveBeenCalledWith('serial-1'));
    expect(await screen.findByText(/测试创建的串口资源已释放/)).toBeVisible();
  });

  it('reuses an existing real serial session without closing the external owner', async () => {
    localStorage.setItem('embedkit.automation.suites', JSON.stringify(serialSuite));
    const shared = { id: 'shared-1', path: 'COM8', baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', dtr: false, rts: false, state: 'connected' as const, rxBytes: 0, txBytes: 0, openedAt: '', events: [] };
    vi.mocked(listSerialPorts).mockResolvedValue([{ path: 'COM8', manufacturer: '', serialNumber: '', vendorId: '', productId: '', pnpId: '', friendlyName: 'Existing Device' }]);
    vi.mocked(listSerialSessions).mockResolvedValue([shared]);

    render(<TestAutomationPage />);
    fireEvent.click(screen.getAllByRole('button', { name: '新建或复用连接' })[0]);
    await waitFor(() => expect(within(screen.getByLabelText('串口 A已有会话')).getByRole('option', { name: 'COM8 · 115200' })).toBeVisible());
    fireEvent.change(screen.getByLabelText('串口 A已有会话'), { target: { value: 'shared-1' } });
    fireEvent.click(screen.getByRole('button', { name: '复用串口 A' }));
    expect(await screen.findByText(/测试结束不会关闭外部会话/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '运行流程' }));
    await waitFor(() => expect(sendSerialData).toHaveBeenCalledWith('shared-1', 'PING', 'text'));
    await waitFor(() => expect(saveTestRunWithCommunicationSessions).toHaveBeenCalled());
    expect(closeSerialSession).not.toHaveBeenCalledWith('shared-1');
  });

  it('accepts a live serial handoff from communication only after the user chooses a test channel', async () => {
    localStorage.setItem('embedkit.automation.suites', JSON.stringify(serialSuite));
    const shared = { id: 'shared-handoff', path: 'COM9', baudRate: 230400, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', dtr: false, rts: false, state: 'connected' as const, rxBytes: 0, txBytes: 0, openedAt: '', events: [] };
    vi.mocked(listSerialPorts).mockResolvedValue([{ path: 'COM9', manufacturer: '', serialNumber: '', vendorId: '', productId: '', pnpId: '', friendlyName: 'Handoff Device' }]);
    vi.mocked(listSerialSessions).mockResolvedValue([shared]);
    writeSerialTestSessionHandoff(shared);
    window.location.hash = '#/tests?handoff=serial';

    render(<TestAutomationPage />);
    expect(await screen.findByText('来自通信调试')).toBeVisible();
    expect(sendSerialData).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '绑定串口 A' }));
    expect(await screen.findByText(/已将通信调试的 COM9 绑定到串口 A/)).toBeVisible();
    expect(screen.queryByLabelText('串口 A真实串口')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '更换连接' })).toHaveAttribute('aria-expanded', 'false');
    expect(sessionStorage.getItem('embedkit.test-session-handoff.pending')).toBeNull();
    expect(sendSerialData).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '运行流程' }));
    await waitFor(() => expect(sendSerialData).toHaveBeenCalledWith('shared-handoff', 'PING', 'text'));
    await waitFor(() => expect(saveTestRunWithCommunicationSessions).toHaveBeenCalled());
    expect(closeSerialSession).not.toHaveBeenCalledWith('shared-handoff');
  });

  it('rejects a stale communication handoff and keeps direct serial recovery available', async () => {
    const stale = { id: 'stale-session', path: 'COM10', baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', dtr: false, rts: false, state: 'connected' as const, rxBytes: 0, txBytes: 0, openedAt: '', events: [] };
    writeSerialTestSessionHandoff(stale);
    window.location.hash = '#/tests?handoff=serial';
    vi.mocked(listSerialPorts).mockResolvedValue([{ path: 'COM11', manufacturer: '', serialNumber: '', vendorId: '', productId: '', pnpId: '', friendlyName: 'Replacement' }]);
    vi.mocked(listSerialSessions).mockResolvedValue([]);

    render(<TestAutomationPage />);
    expect(await screen.findByText(/来自通信调试的 COM10 会话已失效/)).toBeVisible();
    expect(screen.queryByText('来自通信调试')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '新建或复用连接' })[0]);
    expect(screen.getByLabelText('串口 A真实串口')).toBeEnabled();
    expect(sessionStorage.getItem('embedkit.test-session-handoff.pending')).toBeNull();
  });

  it('reports a recoverable port enumeration failure without blocking flow editing', async () => {
    vi.mocked(listSerialPorts).mockRejectedValue(new Error('串口权限不可用'));
    render(<TestAutomationPage />);
    fireEvent.click(await screen.findByRole('button', { name: '刷新真实串口' }));
    expect(await screen.findByText(/串口枚举失败：串口权限不可用/)).toBeVisible();
    expect(screen.getByText('发送 PING')).toBeVisible();
    expect(screen.getByRole('button', { name: '运行流程' })).toBeEnabled();
  });

  it('links a rerun to its baseline and reports a same-context candidate fix', async () => {
    const testDefinitionSha256 = await createConfigurationFingerprint(tcpSuite[0].cases[0]);
    vi.mocked(listBuildArtifacts).mockResolvedValue([{ schemaVersion: 1, id: 'artifact-1', buildId: 'build-1', kind: 'bin', fileName: 'verified.bin', byteLength: 64, sha256: 'b'.repeat(64), capturedAt: '2026-10-14T00:00:00.000Z' }]);
    vi.mocked(listFirmwareIdentities).mockResolvedValue([{ schemaVersion: 1, id: 'firmware-1', buildArtifactId: 'artifact-1', sha256: 'b'.repeat(64), byteLength: 64, format: 'bin', capturedAt: '2026-10-14T00:00:00.000Z' }]);
    vi.mocked(listTestRuns).mockResolvedValue([{ schemaVersion: 3, id: 'baseline-1', suiteId: 'suite-1', suiteName: 'TCP 设备流程', caseId: 'case-1', caseName: '发送与清理', status: 'failed', startedAt: '2026-10-13T00:00:00.000Z', finishedAt: '2026-10-13T00:00:01.000Z', durationMs: 1000, passed: 0, failed: 1, agentVersion: '1.0.0', firmwareId: 'firmware-1', firmware: { buildId: 'build-1', artifactName: 'verified.bin', artifactType: 'bin', size: 64, modifiedAt: '', sha256: 'b'.repeat(64), analyzedAt: '' }, testDefinitionSha256, inputEnvironment: {}, secretInputCount: 0, communications: [{ channel: 'tcp', transport: 'tcp', sessionId: 'old-network', endpoint: 'client:127.0.0.1:9000', rxBytes: 0, txBytes: 4 }], environment: {}, steps: [{ id: 'step-1', name: '发送 PING', type: 'send', channel: 'tcp', status: 'failed', startedAt: '', finishedAt: '', durationMs: 1000, retries: 0 }], logs: [] }]);
    render(<TestAutomationPage />);
    fireEvent.click(screen.getByText(/运行上下文 ·/));
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
    fireEvent.click(screen.getByText(/运行上下文 ·/));
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
    fireEvent.click(screen.getByText(/运行上下文 ·/));
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
