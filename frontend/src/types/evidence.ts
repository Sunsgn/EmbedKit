export const EVIDENCE_REFERENCE_SCHEMA_VERSION = 1 as const;
export const FINDING_SCHEMA_VERSION = 1 as const;

export type EvidenceKind =
  | 'source'
  | 'artifact'
  | 'log'
  | 'communication'
  | 'register'
  | 'fault'
  | 'trace'
  | 'measurement'
  | 'manual';

export type EvidenceOrigin =
  | 'captured'
  | 'deterministic'
  | 'manual'
  | 'external-ai';

export interface EvidenceLocation {
  file?: string;
  line?: number;
  address?: string;
  byteOffset?: number;
  logLine?: number;
  eventId?: string;
}

export interface EvidenceReference {
  schemaVersion: typeof EVIDENCE_REFERENCE_SCHEMA_VERSION;
  id: string;
  kind: EvidenceKind;
  origin: EvidenceOrigin;
  sourceId: string;
  label: string;
  capturedAt?: string;
  sha256?: string;
  location?: EvidenceLocation;
}

export type FindingConclusionType =
  | 'deterministic'
  | 'derived'
  | 'heuristic'
  | 'manual'
  | 'external-ai';

export type FindingConfidence = 'high' | 'medium' | 'low' | 'unknown';

export interface Finding {
  schemaVersion: typeof FINDING_SCHEMA_VERSION;
  id: string;
  category: string;
  severity: 'info' | 'warning' | 'error';
  conclusionType: FindingConclusionType;
  confidence: FindingConfidence;
  summary: string;
  evidenceIds: string[];
  unknowns: string[];
  verificationSteps: string[];
}
