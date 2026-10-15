import {
  ENGINEERING_PROJECT_SCHEMA_VERSION,
  type EngineeringProject,
  type ProjectEnvironmentRequirement,
  type ProjectFeature,
  type ProjectFeatureSource,
  type ProjectFeatureStatus,
} from '../types/product';

export const PROJECT_FEATURE_LIMIT = 200;
export const PROJECT_ENVIRONMENT_REQUIREMENT_LIMIT = 100;
const PROJECT_TEXT_LIMIT = 20_000;
const FEATURE_TEXT_LIMIT = 8_000;
const FEATURE_LIST_LIMIT = 100;

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

export function normalizeEngineeringProject(value: unknown): EngineeringProject | null {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.updatedAt !== 'string') return null;
  const rawFeatures = value.features ?? [];
  const rawRequirements = value.environmentRequirements ?? [];
  if (!Array.isArray(rawFeatures) || rawFeatures.length > PROJECT_FEATURE_LIMIT || !Array.isArray(rawRequirements) || rawRequirements.length > PROJECT_ENVIRONMENT_REQUIREMENT_LIMIT) return null;
  const features = rawFeatures.map(parseFeature);
  const environmentRequirements = rawRequirements.map(parseRequirement);
  if (features.some(item => item === null) || environmentRequirements.some(item => item === null)) return null;
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
