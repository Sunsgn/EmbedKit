export const KNOWLEDGE_EXPERIENCE_STORAGE_KEY = 'embedkit.knowledge-experiences';
export const KNOWLEDGE_EXPERIENCE_LIMIT = 200;
export const KNOWLEDGE_EXPERIENCE_IMPORT_MAX_BYTES = 2 * 1024 * 1024;

const SCHEMA = 'embedkit.knowledge-experiences';
const VERSION = 1;
const FIELD_LIMIT = 4000;
const LIST_LIMIT = 40;

export type KnowledgeExperienceStatus = 'draft' | 'verified' | 'invalidated';

export interface KnowledgeExperienceRecord {
  schemaVersion: 1;
  id: string;
  title: string;
  symptom: string;
  context: string;
  applicability: string;
  possibleCauses: string[];
  diagnosticSteps: string[];
  resolutionSteps: string[];
  rollbackSteps: string[];
  retestSteps: string[];
  evidenceReferences: string[];
  status: KnowledgeExperienceStatus;
  replacementId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeExperienceLibrary {
  schema: typeof SCHEMA;
  version: typeof VERSION;
  exportedAt: string;
  records: KnowledgeExperienceRecord[];
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const encodedSize = (value: string) => new TextEncoder().encode(value).byteLength;
const clean = (value: unknown, limit = FIELD_LIMIT) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const cleanList = (value: unknown) => Array.isArray(value) ? value.slice(0, LIST_LIMIT).map(item => clean(item, 1000)).filter(Boolean) : [];
const validDate = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : new Date(0).toISOString();

function normalizeRecord(value: unknown): KnowledgeExperienceRecord | null {
  if (!isObject(value)) return null;
  const id = clean(value.id, 120), title = clean(value.title, 200), symptom = clean(value.symptom);
  if (!id || !title || !symptom) return null;
  const status: KnowledgeExperienceStatus = value.status === 'verified' || value.status === 'invalidated' ? value.status : 'draft';
  const record: KnowledgeExperienceRecord = {
    schemaVersion: 1,
    id,
    title,
    symptom,
    context: clean(value.context),
    applicability: clean(value.applicability),
    possibleCauses: cleanList(value.possibleCauses),
    diagnosticSteps: cleanList(value.diagnosticSteps),
    resolutionSteps: cleanList(value.resolutionSteps),
    rollbackSteps: cleanList(value.rollbackSteps),
    retestSteps: cleanList(value.retestSteps),
    evidenceReferences: cleanList(value.evidenceReferences),
    status,
    createdAt: validDate(value.createdAt),
    updatedAt: validDate(value.updatedAt),
  };
  const replacementId = clean(value.replacementId, 120);
  if (replacementId && replacementId !== id) record.replacementId = replacementId;
  return record;
}

function validateRecord(record: KnowledgeExperienceRecord) {
  if (record.status === 'verified' && (!record.evidenceReferences.length || !record.retestSteps.length)) throw new Error('标记为已验证前，必须填写证据引用和复测步骤');
  if (record.status === 'invalidated' && !record.replacementId) throw new Error('标记为已失效时，必须填写替代记录 ID');
}

function normalizeRecords(value: unknown) {
  if (!Array.isArray(value) || value.length > KNOWLEDGE_EXPERIENCE_LIMIT) throw new Error(`经验记录无效或超过 ${KNOWLEDGE_EXPERIENCE_LIMIT} 项上限`);
  const records = value.map(normalizeRecord);
  if (records.some(record => record === null)) throw new Error('经验记录缺少标题、症状或稳定 ID');
  const normalized = records as KnowledgeExperienceRecord[];
  if (new Set(normalized.map(record => record.id)).size !== normalized.length) throw new Error('经验记录包含重复 ID');
  normalized.forEach(validateRecord);
  return normalized.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function parseKnowledgeExperienceLibrary(text: string): KnowledgeExperienceLibrary {
  if (encodedSize(text) > KNOWLEDGE_EXPERIENCE_IMPORT_MAX_BYTES) throw new Error('经验库文件超过 2 MiB 上限');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('经验库文件不是有效 JSON'); }
  if (!isObject(value) || value.schema !== SCHEMA || value.version !== VERSION) throw new Error('经验库格式或版本不受支持');
  return { schema: SCHEMA, version: VERSION, exportedAt: validDate(value.exportedAt), records: normalizeRecords(value.records) };
}

export function readKnowledgeExperiences(storage: Storage = localStorage): KnowledgeExperienceRecord[] {
  const raw = storage.getItem(KNOWLEDGE_EXPERIENCE_STORAGE_KEY);
  if (!raw) return [];
  try { return parseKnowledgeExperienceLibrary(raw).records; } catch { return []; }
}

export function createKnowledgeExperienceLibrary(records: KnowledgeExperienceRecord[]): KnowledgeExperienceLibrary {
  return { schema: SCHEMA, version: VERSION, exportedAt: new Date().toISOString(), records: normalizeRecords(records) };
}

export function saveKnowledgeExperiences(records: KnowledgeExperienceRecord[], storage: Storage = localStorage) {
  const library = createKnowledgeExperienceLibrary(records), serialized = JSON.stringify(library);
  if (encodedSize(serialized) > KNOWLEDGE_EXPERIENCE_IMPORT_MAX_BYTES) throw new Error('经验库超过 2 MiB 上限，请导出并删除不再需要的记录');
  storage.setItem(KNOWLEDGE_EXPERIENCE_STORAGE_KEY, serialized);
  return library.records;
}

export function upsertKnowledgeExperience(input: Omit<KnowledgeExperienceRecord, 'schemaVersion' | 'createdAt' | 'updatedAt'> & { createdAt?: string }, records: KnowledgeExperienceRecord[], now = new Date().toISOString()) {
  const existing = records.find(record => record.id === input.id);
  const normalized = normalizeRecord({ ...input, schemaVersion: 1, createdAt: existing?.createdAt ?? input.createdAt ?? now, updatedAt: now });
  if (!normalized) throw new Error('标题和症状为必填项');
  validateRecord(normalized);
  return normalizeRecords([normalized, ...records.filter(record => record.id !== normalized.id)]);
}

export function searchKnowledgeExperiences(records: KnowledgeExperienceRecord[], query: string, status = '') {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return records.filter(record => (!status || record.status === status) && tokens.every(token => [record.title, record.symptom, record.context, record.applicability, ...record.possibleCauses, ...record.diagnosticSteps, ...record.resolutionSteps, ...record.evidenceReferences].join(' ').toLocaleLowerCase().includes(token)));
}
