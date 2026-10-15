import type { ProjectEnvironmentRequirement } from './product';

export interface DetectedSoftwareInstallation {
  id: string;
  capabilityId: string;
  name: string;
  available: true;
  executable: string;
  version: string;
  rawVersion: string;
  detection: 'path-command' | 'managed-installation';
  durationMs: number;
  installedAt?: string;
  manifestId?: string;
}

export interface SoftwareEnvironmentScan {
  schemaVersion: 1;
  platform: string;
  architecture: string;
  detectedAt: string;
  installations: DetectedSoftwareInstallation[];
  unavailable: Array<{ id: string; capabilityId: string; name: string }>;
}

export type EnvironmentResolutionStatus = 'satisfied' | 'missing' | 'incompatible' | 'unknown-version';

export interface EnvironmentResolution {
  requirement: ProjectEnvironmentRequirement;
  status: EnvironmentResolutionStatus;
  installation?: DetectedSoftwareInstallation;
  candidates: DetectedSoftwareInstallation[];
  blocking: boolean;
  reason: string;
}

export interface SoftwareInstallManifest {
  id: string;
  softwareId: string;
  capabilityId: string;
  name: string;
  version: string;
  platform: string;
  architecture: string;
  sourceUrl: string;
  officialPage: string;
  byteLength: number;
  license: string;
  requiresLicenseAcceptance: boolean;
  archive: 'zip';
  verifiedAt: string;
}

export interface SoftwareInstallJob {
  id: string;
  manifestId: string;
  softwareId: string;
  name: string;
  version: string;
  state: 'running' | 'passed' | 'failed' | 'cancelled';
  progress: number;
  startedAt: string;
  finishedAt: string;
  cancelRequested: boolean;
  events: Array<{ time: string; level: 'info' | 'error'; message: string }>;
  error: string;
  installPath?: string;
  installation?: Omit<DetectedSoftwareInstallation, 'available' | 'rawVersion' | 'durationMs' | 'detection'>;
}
