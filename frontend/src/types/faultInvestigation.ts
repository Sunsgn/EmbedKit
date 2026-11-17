import type { EvidenceReference, Finding, FindingConfidence } from "./evidence";

export const FAULT_INVESTIGATION_SCHEMA_VERSION = 1 as const;

export type InvestigationStatus =
  "draft" | "resolving" | "investigating" | "fixed" | "unresolved";
export type InvestigationAddressRole =
  "pc" | "lr" | "fault-address" | "stack-frame";
export type InvestigationArtifactKind =
  "elf" | "map" | "svd" | "firmware" | "log";

export interface InvestigationArtifact {
  id: string;
  kind: InvestigationArtifactKind;
  fileName: string;
  byteLength: number;
  sha256?: string;
  buildId?: string;
  firmwareId?: string;
  toolchain?: { name: string; version?: string };
  capturedAt: string;
}

export interface AddressResolution {
  address: string;
  normalizedAddress: string;
  role: InvestigationAddressRole;
  architecture: string;
  normalization: string[];
  symbol?: {
    name: string;
    startAddress: string;
    offset: string;
    source: "elf" | "map";
  };
  section?: { name: string; offset: string; source: "elf" | "map" };
  source?: { file: string; line: number; column?: number };
  instruction?: {
    address: string;
    bytes?: string;
    mnemonic: string;
    operands: string;
  };
  peripheral?: {
    name: string;
    register?: string;
    offset?: number;
    access?: string;
  };
  confidence: FindingConfidence;
  evidenceIds: string[];
  unknowns: string[];
}

export interface InvestigationConflict {
  id: string;
  category: "artifact-version" | "address-resolution" | "firmware-identity";
  summary: string;
  evidenceIds: string[];
}

export interface FaultInvestigation {
  schemaVersion: typeof FAULT_INVESTIGATION_SCHEMA_VERSION;
  id: string;
  title: string;
  projectId?: string;
  deviceId?: string;
  firmwareId?: string;
  baselineTestRunId?: string;
  retestRunId?: string;
  architecture: string;
  faultKind: string;
  status: InvestigationStatus;
  input: { rawLog?: string; registers: Record<string, number> };
  artifacts: InvestigationArtifact[];
  addressResolutions: AddressResolution[];
  evidenceReferences: EvidenceReference[];
  findings: Finding[];
  conflicts: InvestigationConflict[];
  unknowns: string[];
  createdAt: string;
  updatedAt: string;
}
