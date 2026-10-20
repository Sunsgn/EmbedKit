export const PART_RECORD_SCHEMA_VERSION = 1 as const;

export type PartParameterValueType = 'number' | 'range' | 'enum' | 'boolean' | 'text';
export type PartParameterStatus = 'verified' | 'imported' | 'inferred' | 'unknown' | 'conflict';
export type PartDocumentKind =
  | 'datasheet'
  | 'reference-manual'
  | 'user-guide'
  | 'programming-manual'
  | 'application-note'
  | 'errata'
  | 'hardware-design-guide'
  | 'getting-started-guide'
  | 'product-page'
  | 'other';
export type PartSourceKind = 'manufacturer' | 'distributor' | 'aggregator' | 'user-import' | 'builtin';
export type PartLifecycleStatus = 'active' | 'not-recommended' | 'last-time-buy' | 'obsolete' | 'unknown';

export interface PartEvidenceReference {
  id: string;
  sourceId: string;
  documentId?: string;
  url?: string;
  page?: number;
  section?: string;
  retrievedAt?: string;
  note?: string;
}

export interface PartParameter {
  key: string;
  label: string;
  valueType: PartParameterValueType;
  value?: string | number | boolean | string[];
  min?: number;
  typical?: number;
  max?: number;
  unit?: string;
  conditions: string[];
  evidenceIds: string[];
  status: PartParameterStatus;
}

export interface PartDocument {
  id: string;
  kind: PartDocumentKind;
  title: string;
  url?: string;
  sourceId: string;
  version?: string;
  publishedAt?: string;
  verifiedAt?: string;
  sha256?: string;
}

export interface PartSource {
  id: string;
  kind: PartSourceKind;
  name: string;
  url?: string;
  retrievedAt?: string;
}

export interface PartVariant {
  mpn: string;
  package?: string;
  temperatureMinC?: number;
  temperatureMaxC?: number;
  lifecycle: PartLifecycleStatus;
}

export interface PartRecord {
  schemaVersion: typeof PART_RECORD_SCHEMA_VERSION;
  id: string;
  manufacturer: string;
  mpn: string;
  category: string;
  subcategory: string;
  description: string;
  tags: string[];
  variants: PartVariant[];
  parameters: PartParameter[];
  documents: PartDocument[];
  sources: PartSource[];
  evidence: PartEvidenceReference[];
  createdAt: string;
  updatedAt: string;
}
