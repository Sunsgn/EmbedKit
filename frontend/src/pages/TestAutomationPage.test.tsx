import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TestAutomationPage from './TestAutomationPage';
import { getAgentStatus } from '../services/agentClient';
import { closeNetworkSession, openNetworkSession, sendNetworkData } from '../services/networkAgent';
import { listSerialSessions } from '../services/serialAgent';
import { getProductSetting, listDeviceProjects, listTestRuns, saveTestRun } from '../services/productStorage';

vi.mock('../services/agentClient', () => ({ getAgentStatus: vi.fn() }));
vi.mock('../services/networkAgent', () => ({ closeNetworkSession: vi.fn(), openNetworkSession: vi.fn(), readNetworkSession: vi.fn(), sendNetworkData: vi.fn() }));
vi.mock('../services/serialAgent', () => ({ listSerialSessions: vi.fn(), readSerialSession: vi.fn(), sendSerialData: vi.fn() }));
vi.mock('../services/productStorage', () => ({ deleteTestRun: vi.fn(), getProductSetting: vi.fn(), listDeviceProjects: vi.fn(), listTestRuns: vi.fn(), saveTestRun: vi.fn() }));

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
    vi.mocked(getProductSetting).mockResolvedValue(undefined);
    vi.mocked(listDeviceProjects).mockResolvedValue([]);
    vi.mocked(saveTestRun).mockResolvedValue(undefined);
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
    await waitFor(() => expect(saveTestRun).toHaveBeenCalledWith(expect.objectContaining({ schemaVersion: 2, caseName: '发送与清理', status: 'passed', agentVersion: '1.0.0', passed: 1, failed: 0, communications: [expect.objectContaining({ transport: 'tcp', sessionId: 'network-1', txBytes: 4, rxBytes: 0 })] })));
    expect(screen.getByText(/测试创建的网络资源已释放/)).toBeVisible();
  });

  it('keeps flow editing available when the Agent is offline', async () => {
    vi.mocked(getAgentStatus).mockRejectedValue(new Error('offline'));
    render(<TestAutomationPage />);
    await waitFor(() => expect(getAgentStatus).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: '运行流程' })).toBeEnabled();
    expect(screen.getByText('发送 PING')).toBeVisible();
  });

  it('optionally snapshots a real firmware fingerprint and selected device', async () => {
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
    vi.mocked(getProductSetting).mockImplementation(async (key) =>
      key === 'activeProjectId'
        ? 'project-1'
        : key === 'activeDeviceId'
          ? 'device-1'
          : null,
    );
    vi.mocked(listDeviceProjects).mockResolvedValue([
      {
        id: 'project-1',
        name: '控制器',
        productModel: 'EK-1',
        chipModel: '',
        description: '',
        tags: [],
        devices: [
          {
            id: 'device-1',
            name: '样机 A',
            serialNumber: 'SN001',
            hardwareVersion: '1.0',
            firmwareVersion: '2.0',
            channels: [],
          },
        ],
        createdAt: '2026-10-12T00:00:00.000Z',
        updatedAt: '2026-10-12T00:00:00.000Z',
      },
    ]);

    render(<TestAutomationPage />);
    await waitFor(() => expect(screen.getByText('控制器 / 样机 A')).toBeVisible());
    fireEvent.change(screen.getByLabelText('已计算固件指纹'), {
      target: { value: 'build-1:0' },
    });
    fireEvent.click(screen.getByRole('button', { name: '运行流程' }));

    await waitFor(() =>
      expect(saveTestRun).toHaveBeenCalledWith(
        expect.objectContaining({
          device: expect.objectContaining({ serialNumber: 'SN001' }),
          firmware: expect.objectContaining({
            buildId: 'build-1',
            artifactName: 'release.bin',
            sha256: 'a'.repeat(64),
          }),
        }),
      ),
    );
  });
});
