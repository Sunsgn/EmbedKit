import { normalizePartRecord } from '../../services/partCatalog';
import type { PartRecord } from '../../types';
import type { PartSelectionEvaluation, SelectionCriterion } from './selectionEngine';

export const PART_SELECTION_STORAGE_KEY = 'embedkit.part-selection-records';
export const PART_SELECTION_RECORD_LIMIT = 100;
export const PART_SELECTION_CANDIDATE_LIMIT = 25;
const MAX_STORAGE_BYTES = 4 * 1024 * 1024;

export interface PartSelectionRecord {
  schemaVersion: 1;
  id: string;
  name: string;
  scope: string;
  createdAt: string;
  updatedAt: string;
  criteria: SelectionCriterion[];
  parts: PartRecord[];
  evaluations: PartSelectionEvaluation[];
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, limit: number) => typeof value === 'string' && value.trim() && value.trim().length <= limit ? value.trim() : null;
const bytes = (value: string) => new TextEncoder().encode(value).byteLength;

function parseCriterion(value: unknown): SelectionCriterion | null {
  if (!isObject(value)) return null;
  const id = text(value.id, 100), key = text(value.key, 100), label = text(value.label, 200), operator = value.operator;
  if (!id || !key || !label || value.required !== true) return null;
  if (operator === 'equals' && (typeof value.value === 'string' || typeof value.value === 'boolean')) return { id, key, label, required: true, operator, value: value.value };
  if (operator === 'at-least' && typeof value.value === 'number' && Number.isFinite(value.value)) return { id, key, label, required: true, operator, value: value.value, ...(text(value.unit, 40) ? { unit: text(value.unit, 40)! } : {}) };
  if (operator === 'contains-range' && typeof value.min === 'number' && typeof value.max === 'number' && Number.isFinite(value.min) && Number.isFinite(value.max) && value.min <= value.max) return { id, key, label, required: true, operator, min: value.min, max: value.max, ...(text(value.unit, 40) ? { unit: text(value.unit, 40)! } : {}) };
  return null;
}

function parseEvaluation(value: unknown): PartSelectionEvaluation | null {
  if (!isObject(value)) return null;
  const partId = text(value.partId, 256), mpn = text(value.mpn, 256), outcome = value.outcome;
  if (!partId || !mpn || !['eligible', 'needs-verification', 'excluded'].includes(String(outcome)) || !Array.isArray(value.evaluations) || value.evaluations.length > 32) return null;
  const evaluations = value.evaluations.map(item => {
    if (!isObject(item)) return null;
    const criterionId = text(item.criterionId, 100), label = text(item.label, 200), message = text(item.message, 1_000), itemOutcome = item.outcome;
    const allowedStatuses = ['verified', 'imported', 'inferred', 'unknown', 'conflict'];
    if (!criterionId || !label || !message || !['match', 'mismatch', 'unknown'].includes(String(itemOutcome)) || !Array.isArray(item.evidenceIds) || item.evidenceIds.length > 64 || item.evidenceIds.some(id => typeof id !== 'string') || (item.parameterStatus !== undefined && !allowedStatuses.includes(String(item.parameterStatus)))) return null;
    return { criterionId, label, outcome: itemOutcome as 'match' | 'mismatch' | 'unknown', message, ...(typeof item.parameterStatus === 'string' ? { parameterStatus: item.parameterStatus as never } : {}), evidenceIds: item.evidenceIds };
  });
  if (evaluations.some(item => item === null)) return null;
  const counts = [value.matched, value.unknown, value.mismatched];
  if (counts.some(item => !Number.isInteger(item) || Number(item) < 0 || Number(item) > 32)) return null;
  return { partId, mpn, outcome: outcome as PartSelectionEvaluation['outcome'], evaluations: evaluations as PartSelectionEvaluation['evaluations'], matched: value.matched as number, unknown: value.unknown as number, mismatched: value.mismatched as number };
}

export function parsePartSelectionRecord(value: unknown): PartSelectionRecord | null {
  if (!isObject(value) || value.schemaVersion !== 1) return null;
  const id = text(value.id, 256), name = text(value.name, 200), scope = text(value.scope, 100), createdAt = text(value.createdAt, 64), updatedAt = text(value.updatedAt, 64);
  if (!id || !name || !scope || !createdAt || !updatedAt || !Array.isArray(value.criteria) || value.criteria.length > 16 || !Array.isArray(value.parts) || value.parts.length > PART_SELECTION_CANDIDATE_LIMIT || !Array.isArray(value.evaluations) || value.evaluations.length > PART_SELECTION_CANDIDATE_LIMIT) return null;
  const criteria = value.criteria.map(parseCriterion), parts = value.parts.map(normalizePartRecord), evaluations = value.evaluations.map(parseEvaluation);
  if (criteria.some(item => !item) || parts.some(item => !item) || evaluations.some(item => !item)) return null;
  const partIds = new Set((parts as PartRecord[]).map(item => item.id));
  if ((evaluations as PartSelectionEvaluation[]).some(item => !partIds.has(item.partId))) return null;
  return { schemaVersion: 1, id, name, scope, createdAt, updatedAt, criteria: criteria as SelectionCriterion[], parts: parts as PartRecord[], evaluations: evaluations as PartSelectionEvaluation[] };
}

export function listPartSelectionRecords(storage: Storage = localStorage): PartSelectionRecord[] {
  try {
    const raw = storage.getItem(PART_SELECTION_STORAGE_KEY);
    if (!raw || bytes(raw) > MAX_STORAGE_BYTES) return [];
    const values = JSON.parse(raw) as unknown;
    if (!Array.isArray(values) || values.length > PART_SELECTION_RECORD_LIMIT) return [];
    return values.map(parsePartSelectionRecord).filter((item): item is PartSelectionRecord => Boolean(item)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch { return []; }
}

export function savePartSelectionRecord(input: Omit<PartSelectionRecord, 'schemaVersion' | 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<PartSelectionRecord, 'id' | 'createdAt'>>, storage: Storage = localStorage): PartSelectionRecord {
  if (input.parts.length > PART_SELECTION_CANDIDATE_LIMIT) throw new Error(`单条选型记录最多保存 ${PART_SELECTION_CANDIDATE_LIMIT} 个候选`);
  const now = new Date().toISOString(), id = input.id || crypto.randomUUID();
  const record = parsePartSelectionRecord({ ...input, schemaVersion: 1, id, createdAt: input.createdAt || now, updatedAt: now });
  if (!record) throw new Error('选型记录数据无效或超过资源上限');
  const next = [record, ...listPartSelectionRecords(storage).filter(item => item.id !== id)].slice(0, PART_SELECTION_RECORD_LIMIT), serialized = JSON.stringify(next);
  if (bytes(serialized) > MAX_STORAGE_BYTES) throw new Error('选型记录存储超过 4 MiB，请先导出并删除旧记录');
  storage.setItem(PART_SELECTION_STORAGE_KEY, serialized);
  return record;
}

export function deletePartSelectionRecord(id: string, storage: Storage = localStorage) {
  storage.setItem(PART_SELECTION_STORAGE_KEY, JSON.stringify(listPartSelectionRecords(storage).filter(item => item.id !== id)));
}
