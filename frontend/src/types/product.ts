import type { EvidenceReference, Finding } from './evidence';

export type ChannelKind = 'serial' | 'tcp' | 'udp' | 'websocket';
export const ENGINEERING_PROJECT_SCHEMA_VERSION = 3 as const;

export type ProjectFeatureSource = 'user' | 'project-document' | 'deterministic-analysis' | 'imported' | 'external-ai';
export type ProjectFeatureStatus = 'draft' | 'confirmed' | 'verified';

export interface ProjectFeature {
  id: string;
  name: string;
  description: string;
  inputs: string[];
  outputs: string[];
  resources: string[];
  relatedFiles: string[];
  relatedResourceIds: string[];
  source: ProjectFeatureSource;
  status: ProjectFeatureStatus;
  updatedAt: string;
}

export interface ProjectEnvironmentRequirement {
  id: string;
  capabilityId: string;
  displayName: string;
  versionRange: string;
  optional: boolean;
  source: 'user' | 'project-file' | 'imported' | 'deterministic-analysis';
  evidence: string;
}

export interface EngineeringProject {
  schemaVersion?: typeof ENGINEERING_PROJECT_SCHEMA_VERSION;
  id: string;
  name: string;
  productModel: string;
  chipModel: string;
  description: string;
  tags: string[];
  features?: ProjectFeature[];
  environmentRequirements?: ProjectEnvironmentRequirement[];
  resourceLinks?: string[];
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
  schemaVersion?: 3;
  id: string;
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
  firmware?: TestFirmwareEvidence;
  communications?: TestCommunicationEvidence[];
  evidenceReferences?: EvidenceReference[];
  findings?: Finding[];
  environment: Record<string, string>;
  steps: TestStepRun[];
  logs: Array<{ time: string; level: string; text: string }>;
}

export function createEngineeringProject(name = '新工程项目'): EngineeringProject {
  const now = new Date().toISOString();
  return { schemaVersion: ENGINEERING_PROJECT_SCHEMA_VERSION, id: crypto.randomUUID(), name, productModel: '', chipModel: '', description: '', tags: [], features: [], environmentRequirements: [], resourceLinks: [], createdAt: now, updatedAt: now };
}
