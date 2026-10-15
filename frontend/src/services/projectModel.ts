import {
  ENGINEERING_PROJECT_SCHEMA_VERSION,
  type EngineeringProject,
  type ProjectEnvironmentRequirement,
  type ProjectFeature,
  type ProjectFeatureSource,
  type ProjectFeatureStatus,
  type ProjectArtifactSummary,
  type ProjectInventory,
  type ProjectRecognition,
  type ProjectRecognitionCategory,
  type ProjectRecognitionConfidence,
} from '../types/product';

export const PROJECT_FEATURE_LIMIT = 200;
export const PROJECT_ENVIRONMENT_REQUIREMENT_LIMIT = 100;
const PROJECT_TEXT_LIMIT = 20_000;
const FEATURE_TEXT_LIMIT = 8_000;
const FEATURE_LIST_LIMIT = 100;
const PROJECT_INVENTORY_ENTRY_LIMIT = 800;
const PROJECT_ARTIFACT_LIMIT = 500;
const PROJECT_RECOGNITION_EVIDENCE_LIMIT = 500;

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, limit = PROJECT_TEXT_LIMIT) => typeof value === 'string' ? value.slice(0, limit) : '';
const textList = (value: unknown, limit = FEATURE_LIST_LIMIT) => Array.isArray(value) && value.length <= limit && value.every(item => typeof item === 'string') ? value.map(item => item.slice(0, 1000)) : [];

const featureSources = new Set<ProjectFeatureSource>(['user', 'project-document', 'deterministic-analysis', 'imported', 'external-ai']);
const featureStatuses = new Set<ProjectFeatureStatus>(['draft', 'confirmed', 'verified']);

function parseFeature(value: unknown): ProjectFeature | null {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null;
  const source = featureSources.has(value.source as ProjectFeatureSource) ? value.source as ProjectFeatureSource : 'imported';
  const requestedStatus = featureStatuses.has(value.status as ProjectFeatureStatus) ? value.status as ProjectFeatureStatus : 'draft';
  return {
    id: value.id,
    name: text(value.name, 300),
    description: text(value.description, FEATURE_TEXT_LIMIT),
    inputs: textList(value.inputs),
    outputs: textList(value.outputs),
    resources: textList(value.resources),
    relatedFiles: textList(value.relatedFiles),
    relatedResourceIds: textList(value.relatedResourceIds),
    source,
    status: requestedStatus,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
  };
}

function parseRequirement(value: unknown): ProjectEnvironmentRequirement | null {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.capabilityId !== 'string' || typeof value.displayName !== 'string') return null;
  const allowedSources = new Set<ProjectEnvironmentRequirement['source']>(['user', 'project-file', 'imported', 'deterministic-analysis']);
  return {
    id: value.id,
    capabilityId: text(value.capabilityId, 200),
    displayName: text(value.displayName, 300),
    versionRange: text(value.versionRange, 100),
    optional: value.optional === true,
    source: allowedSources.has(value.source as ProjectEnvironmentRequirement['source']) ? value.source as ProjectEnvironmentRequirement['source'] : 'imported',
    evidence: text(value.evidence, 2000),
  };
}

const recognitionCategories = new Set<ProjectRecognitionCategory>(['projectTypes', 'frameworks', 'ides', 'toolchains', 'buildSystems', 'chipCandidates']);
const recognitionConfidences = new Set<ProjectRecognitionConfidence>(['low', 'medium', 'high']);

function nonNegativeInteger(value: unknown) { return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0; }

function parseRecognition(value: unknown): ProjectRecognition | undefined | null {
  if (value === undefined) return undefined;
  if (!isObject(value) || !Array.isArray(value.evidence) || value.evidence.length > PROJECT_RECOGNITION_EVIDENCE_LIMIT) return null;
  const evidence = value.evidence.map(item => {
    if (!isObject(item) || !recognitionCategories.has(item.category as ProjectRecognitionCategory) || typeof item.value !== 'string' || typeof item.path !== 'string' || !recognitionConfidences.has(item.confidence as ProjectRecognitionConfidence)) return null;
    return { category: item.category as ProjectRecognitionCategory, value: text(item.value, 300), path: text(item.path, 1000), confidence: item.confidence as ProjectRecognitionConfidence, detail: text(item.detail, 1000) };
  });
  if (evidence.some(item => item === null)) return null;
  const list = (key: keyof Pick<ProjectRecognition, 'projectTypes' | 'frameworks' | 'ides' | 'toolchains' | 'buildSystems' | 'chipCandidates'>) => textList(value[key], 100);
  return { projectTypes: list('projectTypes'), frameworks: list('frameworks'), ides: list('ides'), toolchains: list('toolchains'), buildSystems: list('buildSystems'), chipCandidates: list('chipCandidates'), confidence: typeof value.confidence === 'number' && Number.isFinite(value.confidence) ? Math.max(0, Math.min(1, value.confidence)) : 0, evidence: evidence as ProjectRecognition['evidence'], unknowns: textList(value.unknowns, 100) };
}

function parseInventory(value: unknown): ProjectInventory | undefined | null {
  if (value === undefined) return undefined;
  if (!isObject(value) || !Array.isArray(value.entries) || value.entries.length > PROJECT_INVENTORY_ENTRY_LIMIT || !Array.isArray(value.warnings) || value.warnings.length > 100) return null;
  const entries = value.entries.map(item => {
    if (!isObject(item) || typeof item.path !== 'string' || !['file', 'directory'].includes(String(item.kind))) return null;
    const category = ['source', 'config', 'artifact', 'other'].includes(String(item.category)) ? item.category as 'source' | 'config' | 'artifact' | 'other' : undefined;
    return { path: text(item.path, 1000), kind: item.kind as 'file' | 'directory', ...(category ? { category } : {}), ...(Number.isSafeInteger(item.byteLength) && Number(item.byteLength) >= 0 ? { byteLength: Number(item.byteLength) } : {}) };
  });
  if (entries.some(item => item === null)) return null;
  return { scannedAt: text(value.scannedAt, 100), fileCount: nonNegativeInteger(value.fileCount), directoryCount: nonNegativeInteger(value.directoryCount), sourceFileCount: nonNegativeInteger(value.sourceFileCount), configFileCount: nonNegativeInteger(value.configFileCount), artifactCount: nonNegativeInteger(value.artifactCount), maxFiles: nonNegativeInteger(value.maxFiles), maxDepth: nonNegativeInteger(value.maxDepth), truncated: value.truncated === true, entries: entries as ProjectInventory['entries'], warnings: textList(value.warnings, 100) };
}

function parseArtifacts(value: unknown): ProjectArtifactSummary[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > PROJECT_ARTIFACT_LIMIT) return null;
  const allowedKinds = new Set<ProjectArtifactSummary['kind']>(['bin', 'hex', 'elf', 'map', 'srec']);
  const result = value.map(item => isObject(item) && typeof item.path === 'string' && allowedKinds.has(item.kind as ProjectArtifactSummary['kind']) && Number.isSafeInteger(item.byteLength) && Number(item.byteLength) >= 0 ? { path: text(item.path, 1000), kind: item.kind as ProjectArtifactSummary['kind'], byteLength: Number(item.byteLength), modifiedAt: text(item.modifiedAt, 100) } : null);
  return result.some(item => item === null) ? null : result as ProjectArtifactSummary[];
}

export function normalizeEngineeringProject(value: unknown): EngineeringProject | null {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.updatedAt !== 'string') return null;
  const rawFeatures = value.features ?? [];
  const rawRequirements = value.environmentRequirements ?? [];
  if (!Array.isArray(rawFeatures) || rawFeatures.length > PROJECT_FEATURE_LIMIT || !Array.isArray(rawRequirements) || rawRequirements.length > PROJECT_ENVIRONMENT_REQUIREMENT_LIMIT) return null;
  const features = rawFeatures.map(parseFeature);
  const environmentRequirements = rawRequirements.map(parseRequirement);
  const recognition = parseRecognition(value.recognition), inventory = parseInventory(value.inventory), artifacts = parseArtifacts(value.artifacts);
  if (features.some(item => item === null) || environmentRequirements.some(item => item === null) || recognition === null || inventory === null || artifacts === null) return null;
  const sourceDisplayName = text(isObject(value.source) ? value.source.displayName : '', 300).split(/[\\/]/).filter(Boolean).pop() ?? '';
  const sourceValue = isObject(value.source) && ['local-directory', 'archive', 'manual'].includes(String(value.source.kind)) ? { kind: value.source.kind as 'local-directory' | 'archive' | 'manual', displayName: sourceDisplayName } : { kind: 'manual' as const, displayName: '' };
  const pathStatus = ['available', 'missing', 'unverified'].includes(String(value.pathStatus)) ? value.pathStatus as EngineeringProject['pathStatus'] : 'unverified';
  return {
    schemaVersion: ENGINEERING_PROJECT_SCHEMA_VERSION,
    id: value.id,
    name: text(value.name, 300),
    productModel: text(value.productModel, 300),
    chipModel: text(value.chipModel, 300),
    description: text(value.description),
    tags: textList(value.tags, 100),
    features: features as ProjectFeature[],
    environmentRequirements: environmentRequirements as ProjectEnvironmentRequirement[],
    resourceLinks: textList(value.resourceLinks, 500),
    source: sourceValue,
    lastOpenedAt: typeof value.lastOpenedAt === 'string' ? value.lastOpenedAt : value.updatedAt,
    favorite: value.favorite === true,
    group: text(value.group, 300),
    pathStatus,
    ...(recognition ? { recognition } : {}),
    ...(inventory ? { inventory } : {}),
    artifacts,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : value.updatedAt,
    updatedAt: value.updatedAt,
  };
}

export function createProjectFeature(name = '新功能'): ProjectFeature {
  return { id: crypto.randomUUID(), name, description: '', inputs: [], outputs: [], resources: [], relatedFiles: [], relatedResourceIds: [], source: 'user', status: 'draft', updatedAt: new Date().toISOString() };
}

export function createEnvironmentRequirement(displayName = '开发工具'): ProjectEnvironmentRequirement {
  return { id: crypto.randomUUID(), capabilityId: '', displayName, versionRange: '', optional: false, source: 'user', evidence: '' };
}
