import {
  EVIDENCE_REFERENCE_SCHEMA_VERSION,
  FINDING_SCHEMA_VERSION,
  type EvidenceKind,
  type EvidenceLocation,
  type EvidenceOrigin,
  type EvidenceReference,
  type Finding,
  type FindingConclusionType,
  type FindingConfidence,
} from '../types/evidence';

export const EVIDENCE_REFERENCE_LIMIT = 2000;
export const FINDING_LIMIT = 1000;

const ID_LIMIT = 160;
const LABEL_LIMIT = 500;
const LIST_ITEM_LIMIT = 1000;
const LIST_LENGTH_LIMIT = 100;

const evidenceKinds = new Set<EvidenceKind>([
  'source',
  'artifact',
  'log',
  'communication',
  'register',
  'fault',
  'trace',
  'measurement',
  'manual',
]);
const evidenceOrigins = new Set<EvidenceOrigin>([
  'captured',
  'deterministic',
  'manual',
  'external-ai',
]);
const conclusionTypes = new Set<FindingConclusionType>([
  'deterministic',
  'derived',
  'heuristic',
  'manual',
  'external-ai',
]);
const confidences = new Set<FindingConfidence>([
  'high',
  'medium',
  'low',
  'unknown',
]);
const severities = new Set<Finding['severity']>(['info', 'warning', 'error']);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const boundedString = (value: unknown, limit: number) =>
  typeof value === 'string' ? value.slice(0, limit) : '';

const validIdentifier = (value: unknown) => {
  const text = boundedString(value, ID_LIMIT);
  return text && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(text) ? text : '';
};

const positiveInteger = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : undefined;

const nonNegativeInteger = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined;

const relativeFile = (value: unknown) => {
  const file = boundedString(value, 500).replace(/\\/g, '/');
  if (!file || file.startsWith('/') || /^[A-Za-z]:\//.test(file)) return undefined;
  if (file.split('/').includes('..')) return undefined;
  return file;
};

const parseLocation = (value: unknown): EvidenceLocation | undefined => {
  if (!isObject(value)) return undefined;
  const location: EvidenceLocation = {};
  const file = relativeFile(value.file);
  const line = positiveInteger(value.line);
  const byteOffset = nonNegativeInteger(value.byteOffset);
  const logLine = positiveInteger(value.logLine);
  const address = /^0x[0-9a-f]+$/i.test(String(value.address ?? ''))
    ? String(value.address)
    : undefined;
  const eventId = validIdentifier(value.eventId);
  if (file) location.file = file;
  if (line !== undefined) location.line = line;
  if (address) location.address = address;
  if (byteOffset !== undefined) location.byteOffset = byteOffset;
  if (logLine !== undefined) location.logLine = logLine;
  if (eventId) location.eventId = eventId;
  return Object.keys(location).length ? location : undefined;
};

const stringList = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.slice(0, LIST_ITEM_LIMIT))
        .filter(Boolean)
        .slice(0, LIST_LENGTH_LIMIT)
    : [];

export function parseEvidenceReference(value: unknown): EvidenceReference | null {
  if (!isObject(value) || value.schemaVersion !== EVIDENCE_REFERENCE_SCHEMA_VERSION) return null;
  const id = validIdentifier(value.id);
  const sourceId = validIdentifier(value.sourceId);
  const kind = value.kind as EvidenceKind;
  const origin = value.origin as EvidenceOrigin;
  if (!id || !sourceId || !evidenceKinds.has(kind) || !evidenceOrigins.has(origin)) return null;
  const capturedAt = boundedString(value.capturedAt, 40);
  const sha256 = boundedString(value.sha256, 64).toLowerCase();
  const location = parseLocation(value.location);
  return {
    schemaVersion: EVIDENCE_REFERENCE_SCHEMA_VERSION,
    id,
    kind,
    origin,
    sourceId,
    label: boundedString(value.label, LABEL_LIMIT),
    ...(capturedAt && !Number.isNaN(Date.parse(capturedAt)) ? { capturedAt } : {}),
    ...(sha256 && /^[0-9a-f]{64}$/.test(sha256) ? { sha256 } : {}),
    ...(location ? { location } : {}),
  };
}

export function normalizeEvidenceReferences(value: unknown): EvidenceReference[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: EvidenceReference[] = [];
  for (const item of value) {
    const reference = parseEvidenceReference(item);
    if (!reference || seen.has(reference.id)) continue;
    seen.add(reference.id);
    result.push(reference);
    if (result.length >= EVIDENCE_REFERENCE_LIMIT) break;
  }
  return result;
}

export function parseFinding(value: unknown): Finding | null {
  if (!isObject(value) || value.schemaVersion !== FINDING_SCHEMA_VERSION) return null;
  const id = validIdentifier(value.id);
  const category = boundedString(value.category, 100);
  const severity = value.severity as Finding['severity'];
  const conclusionType = value.conclusionType as FindingConclusionType;
  const confidence = value.confidence as FindingConfidence;
  const summary = boundedString(value.summary, 2000);
  if (
    !id ||
    !category ||
    !summary ||
    !severities.has(severity) ||
    !conclusionTypes.has(conclusionType) ||
    !confidences.has(confidence)
  ) return null;
  return {
    schemaVersion: FINDING_SCHEMA_VERSION,
    id,
    category,
    severity,
    conclusionType,
    confidence,
    summary,
    evidenceIds: stringList(value.evidenceIds).map(validIdentifier).filter(Boolean),
    unknowns: stringList(value.unknowns),
    verificationSteps: stringList(value.verificationSteps),
  };
}

export function normalizeFindings(value: unknown): Finding[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: Finding[] = [];
  for (const item of value) {
    const finding = parseFinding(item);
    if (!finding || seen.has(finding.id)) continue;
    seen.add(finding.id);
    result.push(finding);
    if (result.length >= FINDING_LIMIT) break;
  }
  return result;
}
