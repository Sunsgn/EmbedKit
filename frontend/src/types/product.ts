import type { EvidenceReference, Finding } from './evidence';

export type ChannelKind = 'serial' | 'tcp' | 'udp' | 'websocket';
export const ENGINEERING_PROJECT_SCHEMA_VERSION = 4 as const;

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

export type ProjectRecognitionCategory = 'projectTypes' | 'frameworks' | 'ides' | 'toolchains' | 'buildSystems' | 'chipCandidates';
export type ProjectRecognitionConfidence = 'low' | 'medium' | 'high';

export interface ProjectRecognitionEvidence {
  category: ProjectRecognitionCategory;
  value: string;
  path: string;
  confidence: ProjectRecognitionConfidence;
  detail: string;
}

export interface ProjectRecognition {
  projectTypes: string[];
  frameworks: string[];
  ides: string[];
  toolchains: string[];
  buildSystems: string[];
  chipCandidates: string[];
  confidence: number;
  evidence: ProjectRecognitionEvidence[];
  unknowns: string[];
}

export interface ProjectInventoryEntry {
  path: string;
  kind: 'file' | 'directory';
  category?: 'source' | 'config' | 'artifact' | 'other';
  byteLength?: number;
}

export interface ProjectInventory {
  scannedAt: string;
  fileCount: number;
  directoryCount: number;
  sourceFileCount: number;
  configFileCount: number;
  artifactCount: number;
  maxFiles: number;
  maxDepth: number;
  truncated: boolean;
  entries: ProjectInventoryEntry[];
  warnings: string[];
}

export interface ProjectArtifactSummary {
  path: string;
  kind: 'bin' | 'hex' | 'elf' | 'map' | 'srec';
  byteLength: number;
  modifiedAt: string;
}

export interface EngineeringProject {
  schemaVersion?: 3 | typeof ENGINEERING_PROJECT_SCHEMA_VERSION;
  id: string;
  name: string;
  productModel: string;
  chipModel: string;
  description: string;
  tags: string[];
  features?: ProjectFeature[];
  environmentRequirements?: ProjectEnvironmentRequirement[];
  resourceLinks?: string[];
  source?: { kind: 'local-directory' | 'archive' | 'manual'; displayName: string };
  lastOpenedAt?: string;
  favorite?: boolean;
  group?: string;
  pathStatus?: 'available' | 'missing' | 'unverified';
  recognition?: ProjectRecognition;
  inventory?: ProjectInventory;
  artifacts?: ProjectArtifactSummary[];
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
  return { schemaVersion: ENGINEERING_PROJECT_SCHEMA_VERSION, id: crypto.randomUUID(), name, productModel: '', chipModel: '', description: '', tags: [], features: [], environmentRequirements: [], resourceLinks: [], source: { kind: 'manual', displayName: '' }, lastOpenedAt: now, favorite: false, group: '', pathStatus: 'unverified', artifacts: [], createdAt: now, updatedAt: now };
}
