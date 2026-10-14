import type { EvidenceReference, Finding } from './evidence';

export type ChannelKind = 'serial' | 'tcp' | 'udp' | 'websocket';
export type NetworkRole = 'client' | 'server';

export interface SerialChannelOptions {
  path: string;
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: 'none' | 'even' | 'odd' | 'mark' | 'space';
  flowControl: 'none' | 'hardware';
  dtr: boolean;
  rts: boolean;
  frameMode: 'auto' | 'line' | 'idle' | 'raw';
  frameGapMs: number;
}

export interface NetworkChannelOptions {
  role: NetworkRole;
  host: string;
  port: number;
  localPort: number;
}

export interface DeviceChannel {
  id: string;
  name: string;
  kind: ChannelKind;
  enabled: boolean;
  autoConnect: boolean;
  reconnectEnabled: boolean;
  reconnectIntervalMs: number;
  reconnectMaxAttempts: number;
  serial?: SerialChannelOptions;
  network?: NetworkChannelOptions;
  websocketUrl?: string;
}

export interface DeviceProfile {
  id: string;
  name: string;
  serialNumber: string;
  hardwareVersion: string;
  firmwareVersion: string;
  channels: DeviceChannel[];
}

export interface DeviceProject {
  id: string;
  name: string;
  productModel: string;
  chipModel: string;
  description: string;
  tags: string[];
  devices: DeviceProfile[];
  createdAt: string;
  updatedAt: string;
}

export type TestRunStatus = 'passed' | 'failed' | 'aborted' | 'error';

export interface TestStepRun {
  id: string;
  name: string;
  type: string;
  channel: string;
  status: 'passed' | 'failed' | 'skipped';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  retries: number;
  error?: string;
  evidence?: {
    source: 'device-response' | 'manual-confirmation' | 'runtime';
    expected?: string;
    observed?: string;
    timeoutMs?: number;
  };
  evidenceReferences?: EvidenceReference[];
}

export interface TestDeviceEvidence {
  projectName: string;
  deviceName: string;
  serialNumber: string;
  hardwareVersion: string;
  firmwareVersion: string;
}

export interface TestFirmwareEvidence {
  buildId: string;
  artifactName: string;
  artifactType: string;
  size: number;
  modifiedAt: string;
  sha256: string;
  analyzedAt: string;
}

export interface TestCommunicationEvidence {
  channel: string;
  transport: ChannelKind;
  sessionId: string;
  endpoint: string;
  rxBytes: number;
  txBytes: number;
}

export interface TestRunRecord {
  schemaVersion?: 2;
  id: string;
  projectId: string;
  deviceId: string;
  suiteId: string;
  suiteName: string;
  caseId: string;
  caseName: string;
  status: TestRunStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  passed: number;
  failed: number;
  agentVersion: string;
  projectRevisionId?: string;
  firmwareId?: string;
  communicationSessionIds?: string[];
  baselineRunId?: string;
  testDefinitionSha256?: string;
  inputEnvironment?: Record<string, string>;
  secretInputCount?: number;
  device?: TestDeviceEvidence;
  firmware?: TestFirmwareEvidence;
  communications?: TestCommunicationEvidence[];
  evidenceReferences?: EvidenceReference[];
  findings?: Finding[];
  environment: Record<string, string>;
  steps: TestStepRun[];
  logs: Array<{ time: string; level: string; text: string }>;
}

export function createDefaultSerialChannel(name = '主串口'): DeviceChannel {
  return { id: crypto.randomUUID(), name, kind: 'serial', enabled: true, autoConnect: true, reconnectEnabled: true, reconnectIntervalMs: 500, reconnectMaxAttempts: 8, serial: { path: '', baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', dtr: false, rts: false, frameMode: 'auto', frameGapMs: 30 } };
}

export function createDeviceProject(name = '新设备项目'): DeviceProject {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name, productModel: '', chipModel: '', description: '', tags: [], devices: [{ id: crypto.randomUUID(), name: '测试设备 1', serialNumber: '', hardwareVersion: '', firmwareVersion: '', channels: [createDefaultSerialChannel()] }], createdAt: now, updatedAt: now };
}
