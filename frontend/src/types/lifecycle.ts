import type { ChannelKind } from './product';

export const PROJECT_REVISION_SCHEMA_VERSION = 1 as const;
export const BUILD_ARTIFACT_SCHEMA_VERSION = 1 as const;
export const FIRMWARE_IDENTITY_SCHEMA_VERSION = 1 as const;
export const COMMUNICATION_SESSION_SCHEMA_VERSION = 1 as const;

export type ProjectRevisionSource = 'git' | 'directory' | 'archive' | 'manual';

export interface ProjectRevision {
  schemaVersion: typeof PROJECT_REVISION_SCHEMA_VERSION;
  id: string;
  projectId: string;
  source: ProjectRevisionSource;
  capturedAt: string;
  label: string;
  revision?: string;
  sourceSha256?: string;
  dirty?: boolean;
}

export type BuildArtifactKind = 'elf' | 'map' | 'bin' | 'hex' | 'uf2' | 'log' | 'other';

export interface BuildArtifact {
  schemaVersion: typeof BUILD_ARTIFACT_SCHEMA_VERSION;
  id: string;
  projectRevisionId?: string;
  buildId: string;
  kind: BuildArtifactKind;
  fileName: string;
  byteLength: number;
  sha256: string;
  capturedAt: string;
  toolchain?: { name: string; version?: string };
}

export interface FirmwareIdentity {
  schemaVersion: typeof FIRMWARE_IDENTITY_SCHEMA_VERSION;
  id: string;
  buildArtifactId: string;
  sha256: string;
  byteLength: number;
  format: 'bin' | 'hex' | 'elf' | 'uf2' | 'other';
  capturedAt: string;
  versionLabel?: string;
}

export type CommunicationSessionStatus = 'active' | 'completed' | 'failed' | 'aborted';

export interface CommunicationSession {
  schemaVersion: typeof COMMUNICATION_SESSION_SCHEMA_VERSION;
  id: string;
  sourceSessionId?: string;
  transport: ChannelKind;
  status: CommunicationSessionStatus;
  startedAt: string;
  endedAt?: string;
  endpoint: string;
  rxBytes: number;
  txBytes: number;
  projectId?: string;
  deviceId?: string;
  firmwareId?: string;
  agentVersion?: string;
  evidenceIds: string[];
}
