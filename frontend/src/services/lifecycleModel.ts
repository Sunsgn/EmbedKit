import {
  BUILD_ARTIFACT_SCHEMA_VERSION,
  COMMUNICATION_SESSION_SCHEMA_VERSION,
  FIRMWARE_IDENTITY_SCHEMA_VERSION,
  PROJECT_REVISION_SCHEMA_VERSION,
  type BuildArtifact,
  type BuildArtifactKind,
  type CommunicationSession,
  type CommunicationSessionStatus,
  type FirmwareIdentity,
  type ProjectRevision,
  type ProjectRevisionSource,
} from '../types/lifecycle';
import type { ChannelKind } from '../types/product';

export const LIFECYCLE_RECORD_LIMIT = 5000;
const ID_LIMIT = 160;
const LABEL_LIMIT = 500;
const FILE_NAME_LIMIT = 260;
const ENDPOINT_LIMIT = 1000;
const EVIDENCE_ID_LIMIT = 2000;

const revisionSources = new Set<ProjectRevisionSource>(['git', 'directory', 'archive', 'manual']);
const artifactKinds = new Set<BuildArtifactKind>(['elf', 'map', 'bin', 'hex', 'uf2', 'log', 'other']);
const firmwareFormats = new Set<FirmwareIdentity['format']>(['bin', 'hex', 'elf', 'uf2', 'other']);
const transports = new Set<ChannelKind>(['serial', 'tcp', 'udp', 'websocket']);
const sessionStatuses = new Set<CommunicationSessionStatus>(['active', 'completed', 'failed', 'aborted']);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const boundedString = (value: unknown, limit: number) =>
  typeof value === 'string' ? value.slice(0, limit) : '';

const identifier = (value: unknown) => {
  const text = boundedString(value, ID_LIMIT);
  return text && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(text) ? text : '';
};

const timestamp = (value: unknown) => {
  const text = boundedString(value, 40);
  return text && !Number.isNaN(Date.parse(text)) ? text : '';
};

const sha256 = (value: unknown) => {
  const text = boundedString(value, 64).toLowerCase();
  return /^[0-9a-f]{64}$/.test(text) ? text : '';
};

const byteCount = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined;

const portableFileName = (value: unknown) => {
  const text = boundedString(value, FILE_NAME_LIMIT).replace(/\\/g, '/').split('/').pop() ?? '';
  return Array.from(text).filter(character => character.charCodeAt(0) >= 32).join('');
};

export function parseProjectRevision(value: unknown): ProjectRevision | null {
  if (!isObject(value) || value.schemaVersion !== PROJECT_REVISION_SCHEMA_VERSION) return null;
  const id = identifier(value.id), projectId = identifier(value.projectId);
  const source = value.source as ProjectRevisionSource;
  const capturedAt = timestamp(value.capturedAt);
  const label = boundedString(value.label, LABEL_LIMIT);
  if (!id || !projectId || !revisionSources.has(source) || !capturedAt || !label) return null;
  const revision = boundedString(value.revision, LABEL_LIMIT);
  const sourceSha256 = sha256(value.sourceSha256);
  return {
    schemaVersion: PROJECT_REVISION_SCHEMA_VERSION,
    id, projectId, source, capturedAt, label,
    ...(revision ? { revision } : {}),
    ...(sourceSha256 ? { sourceSha256 } : {}),
    ...(typeof value.dirty === 'boolean' ? { dirty: value.dirty } : {}),
  };
}

export function parseBuildArtifact(value: unknown): BuildArtifact | null {
  if (!isObject(value) || value.schemaVersion !== BUILD_ARTIFACT_SCHEMA_VERSION) return null;
  const id = identifier(value.id), buildId = identifier(value.buildId);
  const projectRevisionId = identifier(value.projectRevisionId);
  const kind = value.kind as BuildArtifactKind;
  const fileName = portableFileName(value.fileName);
  const size = byteCount(value.byteLength);
  const digest = sha256(value.sha256);
  const capturedAt = timestamp(value.capturedAt);
  if (!id || !buildId || !artifactKinds.has(kind) || !fileName || size === undefined || !digest || !capturedAt) return null;
  let toolchain: BuildArtifact['toolchain'];
  if (isObject(value.toolchain)) {
    const name = boundedString(value.toolchain.name, 200);
    const version = boundedString(value.toolchain.version, 100);
    if (name) toolchain = { name, ...(version ? { version } : {}) };
  }
  return {
    schemaVersion: BUILD_ARTIFACT_SCHEMA_VERSION,
    id, buildId, kind, fileName, byteLength: size, sha256: digest, capturedAt,
    ...(projectRevisionId ? { projectRevisionId } : {}),
    ...(toolchain ? { toolchain } : {}),
  };
}

export function parseFirmwareIdentity(value: unknown): FirmwareIdentity | null {
  if (!isObject(value) || value.schemaVersion !== FIRMWARE_IDENTITY_SCHEMA_VERSION) return null;
  const id = identifier(value.id), buildArtifactId = identifier(value.buildArtifactId);
  const digest = sha256(value.sha256);
  const size = byteCount(value.byteLength);
  const format = value.format as FirmwareIdentity['format'];
  const capturedAt = timestamp(value.capturedAt);
  if (!id || !buildArtifactId || !digest || size === undefined || !firmwareFormats.has(format) || !capturedAt) return null;
  const versionLabel = boundedString(value.versionLabel, LABEL_LIMIT);
  return {
    schemaVersion: FIRMWARE_IDENTITY_SCHEMA_VERSION,
    id, buildArtifactId, sha256: digest, byteLength: size, format, capturedAt,
    ...(versionLabel ? { versionLabel } : {}),
  };
}

export function parseCommunicationSession(value: unknown): CommunicationSession | null {
  if (!isObject(value) || value.schemaVersion !== COMMUNICATION_SESSION_SCHEMA_VERSION) return null;
  const id = identifier(value.id);
  const transport = value.transport as ChannelKind;
  const status = value.status as CommunicationSessionStatus;
  const startedAt = timestamp(value.startedAt), endedAt = timestamp(value.endedAt);
  const endpoint = boundedString(value.endpoint, ENDPOINT_LIMIT);
  const rxBytes = byteCount(value.rxBytes), txBytes = byteCount(value.txBytes);
  if (!id || !transports.has(transport) || !sessionStatuses.has(status) || !startedAt || (status !== 'active' && !endedAt) || (endedAt && Date.parse(endedAt) < Date.parse(startedAt)) || !endpoint || rxBytes === undefined || txBytes === undefined) return null;
  const firmwareId = identifier(value.firmwareId);
  const sourceSessionId = identifier(value.sourceSessionId);
  const agentVersion = boundedString(value.agentVersion, 100);
  const evidenceIds = Array.isArray(value.evidenceIds)
    ? [...new Set(value.evidenceIds.map(identifier).filter(Boolean))].slice(0, EVIDENCE_ID_LIMIT)
    : [];
  return {
    schemaVersion: COMMUNICATION_SESSION_SCHEMA_VERSION,
    id, transport, status, startedAt, endpoint, rxBytes, txBytes, evidenceIds,
    ...(sourceSessionId ? { sourceSessionId } : {}),
    ...(endedAt ? { endedAt } : {}),
    ...(firmwareId ? { firmwareId } : {}),
    ...(agentVersion ? { agentVersion } : {}),
  };
}

export function normalizeLifecycleRecords<T>(value: unknown, parser: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>(), result: T[] = [];
  for (const item of value) {
    const parsed = parser(item);
    const parsedObject: unknown = parsed;
    const id = isObject(parsedObject) ? identifier(parsedObject.id) : '';
    if (!parsed || !id || seen.has(id)) continue;
    seen.add(id);
    result.push(parsed);
    if (result.length >= LIFECYCLE_RECORD_LIMIT) break;
  }
  return result;
}
