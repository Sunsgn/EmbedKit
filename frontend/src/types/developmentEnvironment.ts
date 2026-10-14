import type { ProjectEnvironmentRequirement } from './product';

export interface DetectedSoftwareInstallation {
  id: string;
  capabilityId: string;
  name: string;
  available: true;
  executable: string;
  version: string;
  rawVersion: string;
  detection: 'path-command';
  durationMs: number;
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
