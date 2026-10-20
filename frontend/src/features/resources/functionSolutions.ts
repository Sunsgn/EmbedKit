import { normalizePartRecord } from '../../services/partCatalog';
import { FUNCTION_SOLUTION_SCHEMA_VERSION, type ConstraintOperator, type FunctionSolution, type FunctionTemplate, type PartRole, type SelectionConstraint, type SelectionValueType } from '../../types';
import { listPartSelectionRecords, type PartSelectionRecord } from './selectionRecords';

export const FUNCTION_SOLUTION_STORAGE_KEY = 'embedkit.function-solutions';
export const FUNCTION_SOLUTION_LIMIT = 100;
export const FUNCTION_SOLUTION_ROLE_LIMIT = 32;
export const ROLE_CONSTRAINT_LIMIT = 64;
export const ROLE_CANDIDATE_LIMIT = 100;
const MAX_STORAGE_BYTES = 4 * 1024 * 1024;

const operators: ConstraintOperator[] = ['equals', 'not-equals', 'at-least', 'at-most', 'greater-than', 'less-than', 'contains-range', 'within-range', 'contains-any', 'contains-all', 'supported', 'unsupported', 'manual-verification'];
const valueTypes: SelectionValueType[] = ['number', 'range', 'enum', 'boolean', 'text'];
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, limit = 256) => typeof value === 'string' && value.trim() && value.trim().length <= limit ? value.trim() : null;
const bytes = (value: string) => new TextEncoder().encode(value).byteLength;

function parseConstraint(value: unknown): SelectionConstraint | null {
  if (!isObject(value)) return null;
  const id = text(value.id, 100), parameterId = value.parameterId === undefined ? undefined : text(value.parameterId, 100), parameterKey = value.parameterKey === undefined ? undefined : text(value.parameterKey, 100), customName = value.customName === undefined ? undefined : text(value.customName, 200);
  if (!id || (!parameterId && !parameterKey && !customName) || !valueTypes.includes(value.valueType as SelectionValueType) || !operators.includes(value.operator as ConstraintOperator) || !['required', 'preferred', 'reference', 'undetermined'].includes(String(value.priority)) || !['template', 'user', 'import'].includes(String(value.source))) return null;
  if (value.value !== undefined && !(typeof value.value === 'string' || typeof value.value === 'number' || typeof value.value === 'boolean' || (Array.isArray(value.value) && value.value.length <= 64 && value.value.every(item => typeof item === 'string')))) return null;
  if (typeof value.value === 'number' && !Number.isFinite(value.value)) return null;
  if (value.min !== undefined && (typeof value.min !== 'number' || !Number.isFinite(value.min))) return null;
  if (value.max !== undefined && (typeof value.max !== 'number' || !Number.isFinite(value.max))) return null;
  if (typeof value.min === 'number' && typeof value.max === 'number' && value.min > value.max) return null;
  const unit = value.unit === undefined ? undefined : text(value.unit, 40);
  if (value.unit !== undefined && !unit) return null;
  return {
    id,
    ...(parameterId ? { parameterId } : {}),
    ...(parameterKey ? { parameterKey } : {}),
    ...(customName ? { customName } : {}),
    valueType: value.valueType as SelectionValueType,
    operator: value.operator as ConstraintOperator,
    ...(value.value !== undefined ? { value: value.value as SelectionConstraint['value'] } : {}),
    ...(typeof value.min === 'number' ? { min: value.min } : {}),
    ...(typeof value.max === 'number' ? { max: value.max } : {}),
    ...(unit ? { unit } : {}),
    priority: value.priority as SelectionConstraint['priority'],
    source: value.source as SelectionConstraint['source'],
  };
}

function parseRole(value: unknown): PartRole | null {
  if (!isObject(value)) return null;
  const id = text(value.id, 100), categoryId = text(value.categoryId, 100), name = text(value.name, 200), purpose = typeof value.purpose === 'string' && value.purpose.length <= 500 ? value.purpose : null;
  if (!id || !categoryId || !name || purpose === null || !Array.isArray(value.constraints) || value.constraints.length > ROLE_CONSTRAINT_LIMIT || !Array.isArray(value.candidatePartIds) || value.candidatePartIds.length > ROLE_CANDIDATE_LIMIT || value.candidatePartIds.some(item => !text(item, 256))) return null;
  const constraints = value.constraints.map(parseConstraint);
  if (constraints.some(item => !item)) return null;
  const selectedPartId = value.selectedPartId === undefined ? undefined : text(value.selectedPartId, 256);
  if (value.selectedPartId !== undefined && !selectedPartId) return null;
  return { id, categoryId, name, purpose, constraints: constraints as SelectionConstraint[], candidatePartIds: value.candidatePartIds as string[], ...(selectedPartId ? { selectedPartId } : {}) };
}

function parseCompatibilityResult(value: unknown): FunctionSolution['compatibilityResults'][number] | null {
  if (!isObject(value)) return null;
  const id = text(value.id, 100), ruleId = text(value.ruleId, 100), message = text(value.message, 1_000);
  const outcomes = ['compatible', 'incompatible', 'unknown', 'not-applicable', 'manual-verification'];
  if (!id || !ruleId || !message || !Number.isInteger(value.ruleVersion) || Number(value.ruleVersion) < 1 || !outcomes.includes(String(value.outcome)) || !Array.isArray(value.roleIds) || value.roleIds.length > FUNCTION_SOLUTION_ROLE_LIMIT || value.roleIds.some(item => !text(item, 100)) || !Array.isArray(value.evidenceIds) || value.evidenceIds.length > 128 || value.evidenceIds.some(item => !text(item, 256))) return null;
  return { id, ruleId, ruleVersion: value.ruleVersion as number, roleIds: value.roleIds as string[], outcome: value.outcome as FunctionSolution['compatibilityResults'][number]['outcome'], message, evidenceIds: value.evidenceIds as string[] };
}

export function parseFunctionSolution(value: unknown): FunctionSolution | null {
  if (!isObject(value) || value.schemaVersion !== FUNCTION_SOLUTION_SCHEMA_VERSION) return null;
  const id = text(value.id), name = text(value.name, 200), description = typeof value.description === 'string' && value.description.length <= 4_000 ? value.description : null, createdAt = text(value.createdAt, 64), updatedAt = text(value.updatedAt, 64);
  if (!id || !name || description === null || !createdAt || !updatedAt || !Array.isArray(value.globalConstraints) || value.globalConstraints.length > ROLE_CONSTRAINT_LIMIT || !Array.isArray(value.roles) || value.roles.length > FUNCTION_SOLUTION_ROLE_LIMIT || !Array.isArray(value.parts) || value.parts.length > FUNCTION_SOLUTION_ROLE_LIMIT * ROLE_CANDIDATE_LIMIT || !Array.isArray(value.compatibilityResults)) return null;
  const globalConstraints = value.globalConstraints.map(parseConstraint), roles = value.roles.map(parseRole), parts = value.parts.map(normalizePartRecord), compatibilityResults = value.compatibilityResults.map(parseCompatibilityResult);
  if (globalConstraints.some(item => !item) || roles.some(item => !item) || parts.some(item => !item) || compatibilityResults.some(item => !item)) return null;
  const partIds = new Set((parts as FunctionSolution['parts']).map(item => item.id));
  const roleIds = new Set((roles as PartRole[]).map(role => role.id));
  if (roleIds.size !== roles.length || (roles as PartRole[]).some(role => role.candidatePartIds.some(partId => !partIds.has(partId)) || (role.selectedPartId && !partIds.has(role.selectedPartId))) || (compatibilityResults as FunctionSolution['compatibilityResults']).some(result => result.roleIds.some(roleId => !roleIds.has(roleId)))) return null;
  const summary = isObject(value.evidenceSummary) ? value.evidenceSummary : null;
  if (!summary || ['verified', 'imported', 'unknown', 'conflict'].some(key => !Number.isInteger(summary[key]) || Number(summary[key]) < 0)) return null;
  const templateId = value.templateId === undefined ? undefined : text(value.templateId, 100);
  return {
    schemaVersion: FUNCTION_SOLUTION_SCHEMA_VERSION,
    id,
    name,
    description,
    ...(templateId ? { templateId } : {}),
    globalConstraints: globalConstraints as FunctionSolution['globalConstraints'],
    roles: roles as PartRole[],
    parts: parts as FunctionSolution['parts'],
    compatibilityResults: compatibilityResults as FunctionSolution['compatibilityResults'],
    evidenceSummary: summary as unknown as FunctionSolution['evidenceSummary'],
    ...(isObject(value.migratedFrom) && typeof value.migratedFrom.schemaVersion === 'number' && text(value.migratedFrom.recordId) && text(value.migratedFrom.scope, 100) ? { migratedFrom: value.migratedFrom as unknown as FunctionSolution['migratedFrom'] } : {}),
    createdAt,
    updatedAt,
  };
}

function evidenceSummary(parts: FunctionSolution['parts']): FunctionSolution['evidenceSummary'] {
  const result = { verified: 0, imported: 0, unknown: 0, conflict: 0 };
  for (const parameter of parts.flatMap(part => part.parameters)) {
    if (parameter.status === 'verified') result.verified += 1;
    else if (parameter.status === 'conflict') result.conflict += 1;
    else if (parameter.status === 'unknown') result.unknown += 1;
    else result.imported += 1;
  }
  return result;
}

function migrateConstraint(record: PartSelectionRecord, index: number): SelectionConstraint {
  const criterion = record.criteria[index];
  if (criterion.operator === 'contains-range') return { id: criterion.id, parameterKey: criterion.key, customName: criterion.label, valueType: 'range', operator: criterion.operator, min: criterion.min, max: criterion.max, unit: criterion.unit, priority: 'required', source: 'import' };
  return { id: criterion.id, parameterKey: criterion.key, customName: criterion.label, valueType: typeof criterion.value === 'boolean' ? 'boolean' : typeof criterion.value === 'number' ? 'number' : 'enum', operator: criterion.operator, value: criterion.value, ...('unit' in criterion && criterion.unit ? { unit: criterion.unit } : {}), priority: 'required', source: 'import' };
}

export function migratePartSelectionRecord(record: PartSelectionRecord): FunctionSolution {
  const roleId = `role:${record.id}`;
  return {
    schemaVersion: FUNCTION_SOLUTION_SCHEMA_VERSION,
    id: `migrated:${record.id}`,
    name: record.name,
    description: '由旧版单器件选型记录兼容迁移。',
    globalConstraints: [],
    roles: [{ id: roleId, categoryId: record.scope, name: record.scope === 'mcu' ? 'MCU / 微控制器' : record.scope === 'communication-transceiver' ? '通信收发器' : record.scope, purpose: '保留旧版单器件选型', constraints: record.criteria.map((_, index) => migrateConstraint(record, index)), candidatePartIds: record.parts.map(part => part.id) }],
    parts: record.parts,
    compatibilityResults: [],
    evidenceSummary: evidenceSummary(record.parts),
    migratedFrom: { schemaVersion: 1, recordId: record.id, scope: record.scope },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function createFunctionSolution(template: FunctionTemplate): FunctionSolution {
  const now = new Date().toISOString();
  return {
    schemaVersion: FUNCTION_SOLUTION_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    name: template.name,
    description: template.description,
    templateId: template.id,
    globalConstraints: [],
    roles: template.roles.map(role => ({ id: crypto.randomUUID(), categoryId: role.categoryId, name: role.name, purpose: role.purpose, constraints: role.constraints ?? [], candidatePartIds: [] })),
    parts: [],
    compatibilityResults: [],
    evidenceSummary: { verified: 0, imported: 0, unknown: 0, conflict: 0 },
    createdAt: now,
    updatedAt: now,
  };
}

export function listFunctionSolutions(storage: Storage = localStorage): FunctionSolution[] {
  let stored: FunctionSolution[] = [];
  try {
    const raw = storage.getItem(FUNCTION_SOLUTION_STORAGE_KEY);
    if (raw && bytes(raw) <= MAX_STORAGE_BYTES) {
      const values = JSON.parse(raw) as unknown;
      if (Array.isArray(values) && values.length <= FUNCTION_SOLUTION_LIMIT) stored = values.map(parseFunctionSolution).filter((item): item is FunctionSolution => Boolean(item));
    }
  } catch { stored = []; }
  const knownLegacyIds = new Set(stored.map(item => item.migratedFrom?.recordId).filter(Boolean));
  const migrated = listPartSelectionRecords(storage).filter(record => !knownLegacyIds.has(record.id)).map(migratePartSelectionRecord);
  return [...stored, ...migrated].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function saveFunctionSolution(solution: FunctionSolution, storage: Storage = localStorage) {
  const now = new Date().toISOString();
  const normalized = parseFunctionSolution({ ...solution, evidenceSummary: evidenceSummary(solution.parts), updatedAt: now });
  if (!normalized) throw new Error('功能方案数据无效或超过资源上限');
  const existing = listFunctionSolutions(storage).filter(item => !item.id.startsWith('migrated:') && item.id !== normalized.id);
  const next = [normalized, ...existing].slice(0, FUNCTION_SOLUTION_LIMIT);
  const serialized = JSON.stringify(next);
  if (bytes(serialized) > MAX_STORAGE_BYTES) throw new Error('功能方案存储超过 4 MiB，请先导出或删除旧方案');
  storage.setItem(FUNCTION_SOLUTION_STORAGE_KEY, serialized);
  return normalized;
}

export function deleteFunctionSolution(id: string, storage: Storage = localStorage) {
  if (id.startsWith('migrated:')) throw new Error('旧版记录请在旧记录管理中删除，避免误删原始数据');
  const stored = listFunctionSolutions(storage).filter(item => !item.id.startsWith('migrated:') && item.id !== id);
  storage.setItem(FUNCTION_SOLUTION_STORAGE_KEY, JSON.stringify(stored));
}
