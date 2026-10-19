import type { Chip, ElectronicComponent } from '../types';
import {
  PART_RECORD_SCHEMA_VERSION,
  type PartDocument,
  type PartParameter,
  type PartRecord,
  type PartSource,
} from '../types/parts';

export const PART_PARAMETER_LIMIT = 256;
export const PART_DOCUMENT_LIMIT = 64;
export const PART_SOURCE_LIMIT = 32;
export const PART_EVIDENCE_LIMIT = 512;
export const PART_TAG_LIMIT = 64;
const TEXT_LIMIT = 4_096;

const boundedText = (value: unknown, limit = TEXT_LIMIT) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= limit ? value.trim() : undefined;
const boundedTextList = (value: unknown, limit: number) => Array.isArray(value) && value.length <= limit
  ? value.map(item => boundedText(item, 256)).filter((item): item is string => Boolean(item))
  : undefined;
const safeUrl = (value: unknown) => {
  const text = boundedText(value, 2_048);
  if (!text) return undefined;
  try {
    const parsed = new URL(text);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
};
const stableKey = (value: string) => value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'part';
const nowOrEpoch = (value?: string) => boundedText(value, 64) ?? new Date(0).toISOString();

function legacySource(id: string, manufacturer: string): PartSource {
  return { id, kind: 'builtin', name: `${manufacturer}（内置兼容数据）` };
}

function legacyParameters(parameters: Record<string, string>, sourceId: string): PartParameter[] {
  return Object.entries(parameters).slice(0, PART_PARAMETER_LIMIT).map(([label, value]) => ({
    key: stableKey(label),
    label,
    valueType: 'text',
    value,
    conditions: [],
    evidenceIds: [`${sourceId}:catalog`],
    status: 'imported',
  }));
}

function legacyDocuments(input: { datasheetUrl?: string; reference?: string }, sourceId: string): PartDocument[] {
  const documents: PartDocument[] = [];
  const datasheetUrl = safeUrl(input.datasheetUrl);
  const referenceUrl = safeUrl(input.reference);
  if (datasheetUrl) documents.push({ id: `${sourceId}:datasheet`, kind: 'datasheet', title: '数据手册', url: datasheetUrl, sourceId });
  if (referenceUrl) documents.push({ id: `${sourceId}:reference`, kind: 'reference-manual', title: '参考资料', url: referenceUrl, sourceId });
  return documents;
}

export function migrateElectronicComponent(component: ElectronicComponent): PartRecord {
  const sourceId = `builtin:component:${stableKey(component.id)}`;
  const timestamp = new Date(0).toISOString();
  return {
    schemaVersion: PART_RECORD_SCHEMA_VERSION,
    id: `part:component:${stableKey(component.id)}`,
    manufacturer: component.manufacturer,
    mpn: component.name,
    category: component.category,
    subcategory: component.subcategory,
    description: component.description,
    tags: [...new Set(component.tags)].slice(0, PART_TAG_LIMIT),
    variants: [{ mpn: component.name, package: component.package, lifecycle: 'unknown' }],
    parameters: legacyParameters(component.parameters, sourceId),
    documents: legacyDocuments(component, sourceId),
    sources: [legacySource(sourceId, component.manufacturer)],
    evidence: [{ id: `${sourceId}:catalog`, sourceId, note: '由旧版内置器件目录迁移，尚未完成官方文档逐项核验。' }],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function migrateChip(chip: Chip): PartRecord {
  const sourceId = `builtin:chip:${stableKey(chip.id)}`;
  const parameters = {
    内核: chip.cores,
    主频: chip.frequency,
    Flash: chip.flash,
    RAM: chip.ram,
    外设: chip.peripherals.join('、'),
  };
  const timestamp = new Date(0).toISOString();
  return {
    schemaVersion: PART_RECORD_SCHEMA_VERSION,
    id: `part:chip:${stableKey(chip.id)}`,
    manufacturer: chip.manufacturer,
    mpn: chip.name,
    category: '微控制器与处理器',
    subcategory: chip.series,
    description: `${chip.cores} 内核嵌入式处理器，集成 ${chip.peripherals.slice(0, 6).join('、')} 等外设。`,
    tags: [...new Set([chip.series, chip.cores, ...chip.peripherals])].slice(0, PART_TAG_LIMIT),
    variants: [{ mpn: chip.name, package: chip.package, lifecycle: 'unknown' }],
    parameters: legacyParameters(parameters, sourceId),
    documents: legacyDocuments(chip, sourceId),
    sources: [legacySource(sourceId, chip.manufacturer)],
    evidence: [{ id: `${sourceId}:catalog`, sourceId, note: '由旧版内置芯片目录迁移，尚未完成官方文档逐项核验。' }],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function normalizePartRecord(value: unknown): PartRecord | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (input.schemaVersion !== PART_RECORD_SCHEMA_VERSION) return null;
  const id = boundedText(input.id, 256), manufacturer = boundedText(input.manufacturer, 256), mpn = boundedText(input.mpn, 256);
  const category = boundedText(input.category, 256), subcategory = boundedText(input.subcategory, 256), description = boundedText(input.description);
  const tags = boundedTextList(input.tags, PART_TAG_LIMIT);
  if (!id || !manufacturer || !mpn || !category || !subcategory || !description || !tags) return null;
  if (!Array.isArray(input.parameters) || input.parameters.length > PART_PARAMETER_LIMIT) return null;
  if (!Array.isArray(input.documents) || input.documents.length > PART_DOCUMENT_LIMIT) return null;
  if (!Array.isArray(input.sources) || input.sources.length === 0 || input.sources.length > PART_SOURCE_LIMIT) return null;
  if (!Array.isArray(input.evidence) || input.evidence.length > PART_EVIDENCE_LIMIT) return null;
  if (!Array.isArray(input.variants) || input.variants.length === 0 || input.variants.length > 128) return null;

  // Versioned records are retained without guessing missing or malformed fields.
  // Detailed adapter validation is added per source; this gate protects persistence bounds.
  return {
    ...(input as unknown as PartRecord),
    id,
    manufacturer,
    mpn,
    category,
    subcategory,
    description,
    tags: [...new Set(tags)],
    createdAt: nowOrEpoch(boundedText(input.createdAt, 64)),
    updatedAt: nowOrEpoch(boundedText(input.updatedAt, 64)),
  };
}
