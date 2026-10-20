import type { ConstraintPriority, PartParameter, PartParameterStatus, PartRecord, ParameterDefinition, SelectionConstraint } from '../../types';
import { convertUnit, unitDefinitions } from './selectionRegistry';

export type SelectionCriterion =
  | { id: string; key: string; label: string; required: true; operator: 'equals'; value: string | boolean }
  | { id: string; key: string; label: string; required: true; operator: 'at-least'; value: number; unit?: string }
  | { id: string; key: string; label: string; required: true; operator: 'contains-range'; min: number; max: number; unit?: string };

export type CriterionOutcome = 'match' | 'mismatch' | 'unknown';
export interface CriterionEvaluation {
  criterionId: string;
  label: string;
  outcome: CriterionOutcome;
  message: string;
  parameterStatus?: PartParameterStatus;
  evidenceIds: string[];
}

export interface PartSelectionEvaluation {
  partId: string;
  mpn: string;
  outcome: 'eligible' | 'needs-verification' | 'excluded';
  evaluations: CriterionEvaluation[];
  matched: number;
  unknown: number;
  mismatched: number;
}

const displayValue = (parameter: PartParameter) => {
  if (parameter.value !== undefined) return Array.isArray(parameter.value) ? parameter.value.join('、') : String(parameter.value);
  if (parameter.min !== undefined || parameter.max !== undefined) return `${parameter.min ?? '?'}～${parameter.max ?? '?'}${parameter.unit ?? ''}`;
  return '未提供';
};

function findParameter(part: PartRecord, key: string) {
  return part.parameters.find(parameter => parameter.key === key);
}

function evaluateCriterion(part: PartRecord, criterion: SelectionCriterion): CriterionEvaluation {
  const parameter = findParameter(part, criterion.key);
  if (!parameter || parameter.status === 'unknown' || parameter.status === 'conflict') return {
    criterionId: criterion.id,
    label: criterion.label,
    outcome: 'unknown',
    message: parameter?.status === 'conflict' ? '多个来源存在冲突，不能用于硬条件判断' : '没有可靠参数，不能判定为满足',
    parameterStatus: parameter?.status,
    evidenceIds: parameter?.evidenceIds ?? [],
  };

  let matches = false;
  if (criterion.operator === 'equals') {
    const values = Array.isArray(parameter.value) ? parameter.value : [parameter.value];
    matches = values.some(value => typeof criterion.value === 'string' && typeof value === 'string'
      ? value.toLowerCase() === criterion.value.toLowerCase()
      : value === criterion.value);
  } else if (criterion.operator === 'at-least') {
    const available = typeof parameter.value === 'number' ? parameter.value : parameter.max ?? parameter.typical ?? parameter.min;
    if (available === undefined) return { criterionId: criterion.id, label: criterion.label, outcome: 'unknown', message: '参数不是可比较数值', parameterStatus: parameter.status, evidenceIds: parameter.evidenceIds };
    matches = available >= criterion.value;
  } else {
    if (parameter.min === undefined || parameter.max === undefined) return { criterionId: criterion.id, label: criterion.label, outcome: 'unknown', message: '缺少完整上下限，不能验证工作范围', parameterStatus: parameter.status, evidenceIds: parameter.evidenceIds };
    matches = parameter.min <= criterion.min && parameter.max >= criterion.max;
  }

  return {
    criterionId: criterion.id,
    label: criterion.label,
    outcome: matches ? 'match' : 'mismatch',
    message: `${matches ? '满足' : '不满足'}：${displayValue(parameter)}${parameter.status === 'verified' ? '' : '（尚需官方资料核验）'}`,
    parameterStatus: parameter.status,
    evidenceIds: parameter.evidenceIds,
  };
}

export function evaluatePartSelection(part: PartRecord, criteria: SelectionCriterion[]): PartSelectionEvaluation {
  const evaluations = criteria.map(criterion => evaluateCriterion(part, criterion));
  const matched = evaluations.filter(item => item.outcome === 'match').length;
  const unknown = evaluations.filter(item => item.outcome === 'unknown').length;
  const mismatched = evaluations.filter(item => item.outcome === 'mismatch').length;
  const hasUnverifiedMatch = evaluations.some(item => item.outcome === 'match' && item.parameterStatus !== 'verified');
  return {
    partId: part.id,
    mpn: part.mpn,
    outcome: mismatched > 0 ? 'excluded' : unknown > 0 || hasUnverifiedMatch ? 'needs-verification' : 'eligible',
    evaluations,
    matched,
    unknown,
    mismatched,
  };
}

export function rankPartSelections(parts: PartRecord[], criteria: SelectionCriterion[]) {
  const rank = { eligible: 0, 'needs-verification': 1, excluded: 2 } as const;
  return parts.map(part => evaluatePartSelection(part, criteria)).sort((left, right) =>
    rank[left.outcome] - rank[right.outcome] || right.matched - left.matched || left.mpn.localeCompare(right.mpn));
}

export interface DynamicCriterionEvaluation extends CriterionEvaluation {
  priority: ConstraintPriority;
}

export interface DynamicPartSelectionEvaluation {
  partId: string;
  mpn: string;
  outcome: 'eligible' | 'needs-verification' | 'excluded';
  evaluations: DynamicCriterionEvaluation[];
  requiredMatched: number;
  preferredMatched: number;
  unknown: number;
  mismatched: number;
}

const stringValues = (parameter: PartParameter) => (Array.isArray(parameter.value) ? parameter.value : [parameter.value])
  .filter((value): value is string => typeof value === 'string')
  .flatMap(value => [value, ...value.split(/[,;/|、]+/)])
  .map(value => value.trim().toLocaleLowerCase())
  .filter(Boolean);

const normalizedParameterName = (value: string) => value.toLocaleLowerCase().replace(/[\s_\-/（）()]+/g, '');

function resolveDynamicParameter(part: PartRecord, constraint: SelectionConstraint, definition?: ParameterDefinition): { parameter?: PartParameter; message?: string } {
  const key = constraint.parameterKey || definition?.parameterKey;
  const keyedParameter = key ? findParameter(part, key) : undefined;
  if (keyedParameter) return { parameter: keyedParameter };
  const names = [constraint.customName, definition?.label, ...(definition?.aliases ?? [])].filter((value): value is string => Boolean(value)).map(normalizedParameterName);
  if (!names.length) return { message: '条件缺少名称和参数键，不能匹配候选字段' };
  const exact = part.parameters.filter(parameter => names.includes(normalizedParameterName(parameter.label)) || names.includes(normalizedParameterName(parameter.key)));
  if (exact.length === 1) return { parameter: exact[0] };
  if (exact.length > 1) return { message: `候选存在 ${exact.length} 个同名字段，请手动指定参数键` };
  const partial = part.parameters.filter(parameter => {
    const labels = [normalizedParameterName(parameter.label), normalizedParameterName(parameter.key)];
    return names.some(name => name.length >= 3 && labels.some(label => label.includes(name) || name.includes(label)));
  });
  if (partial.length === 1) return { parameter: partial[0] };
  if (partial.length > 1) return { message: `候选存在 ${partial.length} 个近似字段，请手动指定参数键` };
  return { message: `候选资料中没有与“${constraint.customName || definition?.label || key || '当前条件'}”匹配的字段` };
}

function unknownDynamic(constraint: SelectionConstraint, message: string, parameter?: PartParameter): DynamicCriterionEvaluation {
  return {
    criterionId: constraint.id,
    label: constraint.customName || constraint.parameterId || '自定义条件',
    priority: constraint.priority,
    outcome: 'unknown',
    message,
    parameterStatus: parameter?.status,
    evidenceIds: parameter?.evidenceIds ?? [],
  };
}

function textNumbers(parameter: PartParameter) {
  if (typeof parameter.value !== 'string') return [];
  return (parameter.value.replace(/−/g, '-').match(/[-+]?\d+(?:\.\d+)?/g) ?? []).map(Number).filter(Number.isFinite);
}

function inferredTextUnit(parameter: PartParameter, preferred?: string) {
  if (typeof parameter.value !== 'string') return parameter.unit;
  const compact = parameter.value.replace(/\s+/g, '').replace(/℃/g, '°C');
  if (preferred && compact.toLocaleLowerCase().includes(preferred.toLocaleLowerCase())) return preferred;
  return [...unitDefinitions].sort((left, right) => right.symbol.length - left.symbol.length).find(item => compact.toLocaleLowerCase().includes(item.symbol.toLocaleLowerCase()))?.symbol;
}

function numericParameterValue(parameter: PartParameter) {
  if (typeof parameter.value === 'number') return parameter.value;
  const structured = parameter.typical ?? parameter.max ?? parameter.min;
  if (structured !== undefined) return structured;
  const parsed = textNumbers(parameter);
  return parsed.length === 1 ? parsed[0] : undefined;
}

function rangeParameterValue(parameter: PartParameter) {
  if (parameter.min !== undefined && parameter.max !== undefined) return { min: parameter.min, max: parameter.max };
  const parsed = textNumbers(parameter);
  return parsed.length === 2 ? { min: Math.min(...parsed), max: Math.max(...parsed) } : undefined;
}

function evaluateDynamicCriterion(part: PartRecord, constraint: SelectionConstraint, definitions: ParameterDefinition[]): DynamicCriterionEvaluation {
  const customName = constraint.customName ? normalizedParameterName(constraint.customName) : '';
  const definition = definitions.find(item => item.id === constraint.parameterId || (customName && [item.label, ...(item.aliases ?? [])].some(alias => normalizedParameterName(alias) === customName)));
  const label = constraint.customName || definition?.label || constraint.parameterId || '自定义条件';
  if (constraint.priority === 'undetermined') return unknownDynamic(constraint, '条件尚未确定，不参与筛选');
  if (constraint.operator === 'manual-verification') return unknownDynamic(constraint, '该条件需要人工核验');
  const resolved = resolveDynamicParameter(part, constraint, definition);
  const parameter = resolved.parameter;
  if (!parameter || parameter.status === 'unknown' || parameter.status === 'conflict') return unknownDynamic(
    constraint,
    parameter?.status === 'conflict' ? '多个来源存在冲突，不能自动判断' : resolved.message || '候选缺少可靠参数，需要核验资料',
    parameter,
  );

  let matches: boolean;
  try {
    if (['at-least', 'at-most', 'greater-than', 'less-than'].includes(constraint.operator) ||
      (['equals', 'not-equals'].includes(constraint.operator) && typeof constraint.value === 'number')) {
      const available = numericParameterValue(parameter);
      if (available === undefined || typeof constraint.value !== 'number' || !Number.isFinite(constraint.value)) return unknownDynamic(constraint, '条件或候选不是可比较的有限数值', parameter);
      const sourceUnit = parameter.unit || inferredTextUnit(parameter, constraint.unit || definition?.canonicalUnit);
      const normalized = convertUnit(available, sourceUnit, constraint.unit || definition?.canonicalUnit || sourceUnit);
      if (constraint.operator === 'at-least') matches = normalized >= constraint.value;
      else if (constraint.operator === 'at-most') matches = normalized <= constraint.value;
      else if (constraint.operator === 'greater-than') matches = normalized > constraint.value;
      else if (constraint.operator === 'less-than') matches = normalized < constraint.value;
      else if (constraint.operator === 'not-equals') matches = normalized !== constraint.value;
      else matches = normalized === constraint.value;
    } else if (constraint.operator === 'contains-range' || constraint.operator === 'within-range') {
      const range = rangeParameterValue(parameter);
      if (!range || constraint.min === undefined || constraint.max === undefined || constraint.min > constraint.max) return unknownDynamic(constraint, typeof parameter.value === 'string' && textNumbers(parameter).length > 2 ? '候选文本包含多个数值，无法确定哪两个是范围端点' : '缺少有效的候选或目标范围', parameter);
      const sourceUnit = parameter.unit || inferredTextUnit(parameter, constraint.unit || definition?.canonicalUnit);
      const targetUnit = constraint.unit || definition?.canonicalUnit || sourceUnit;
      const minimum = convertUnit(range.min, sourceUnit, targetUnit);
      const maximum = convertUnit(range.max, sourceUnit, targetUnit);
      matches = constraint.operator === 'contains-range'
        ? minimum <= constraint.min && maximum >= constraint.max
        : minimum >= constraint.min && maximum <= constraint.max;
    } else if (constraint.operator === 'supported' || constraint.operator === 'unsupported' ||
      (['equals', 'not-equals'].includes(constraint.operator) && typeof constraint.value === 'boolean')) {
      if (typeof parameter.value !== 'boolean') return unknownDynamic(constraint, '候选参数不是布尔值', parameter);
      if (constraint.operator === 'supported') matches = parameter.value;
      else if (constraint.operator === 'unsupported') matches = !parameter.value;
      else matches = constraint.operator === 'equals' ? parameter.value === constraint.value : parameter.value !== constraint.value;
    } else {
      const actual = stringValues(parameter);
      const expected = (Array.isArray(constraint.value) ? constraint.value : [constraint.value])
        .filter((value): value is string => typeof value === 'string')
        .map(value => value.toLocaleLowerCase());
      if (!expected.length || !actual.length) return unknownDynamic(constraint, '条件或候选缺少可比较文本', parameter);
      if (constraint.operator === 'contains-all') matches = expected.every(value => actual.includes(value));
      else if (constraint.operator === 'contains-any') matches = expected.some(value => actual.includes(value));
      else if (constraint.operator === 'not-equals') matches = expected.every(value => !actual.includes(value));
      else matches = expected.some(value => actual.includes(value));
    }
  } catch (reason) {
    return unknownDynamic(constraint, reason instanceof Error ? reason.message : '参数换算失败', parameter);
  }

  return {
    criterionId: constraint.id,
    label,
    priority: constraint.priority,
    outcome: matches ? 'match' : 'mismatch',
    message: `${matches ? '满足' : '不满足'}：${displayValue(parameter)}${parameter.status === 'verified' ? '' : '（尚需官方资料核验）'}`,
    parameterStatus: parameter.status,
    evidenceIds: parameter.evidenceIds,
  };
}

export function evaluateDynamicPartSelection(part: PartRecord, constraints: SelectionConstraint[], definitions: ParameterDefinition[]): DynamicPartSelectionEvaluation {
  const evaluations = constraints.map(constraint => evaluateDynamicCriterion(part, constraint, definitions));
  const required = evaluations.filter(item => item.priority === 'required');
  const requiredMismatch = required.some(item => item.outcome === 'mismatch');
  const requiredUnknown = required.some(item => item.outcome === 'unknown');
  const requiredUnverified = required.some(item => item.outcome === 'match' && item.parameterStatus !== 'verified');
  return {
    partId: part.id,
    mpn: part.mpn,
    outcome: requiredMismatch ? 'excluded' : requiredUnknown || requiredUnverified ? 'needs-verification' : 'eligible',
    evaluations,
    requiredMatched: required.filter(item => item.outcome === 'match').length,
    preferredMatched: evaluations.filter(item => item.priority === 'preferred' && item.outcome === 'match').length,
    unknown: evaluations.filter(item => item.outcome === 'unknown').length,
    mismatched: evaluations.filter(item => item.outcome === 'mismatch').length,
  };
}

export function rankDynamicPartSelections(parts: PartRecord[], constraints: SelectionConstraint[], definitions: ParameterDefinition[]) {
  const rank = { eligible: 0, 'needs-verification': 1, excluded: 2 } as const;
  return parts.map(part => evaluateDynamicPartSelection(part, constraints, definitions)).sort((left, right) =>
    rank[left.outcome] - rank[right.outcome]
    || right.preferredMatched - left.preferredMatched
    || right.requiredMatched - left.requiredMatched
    || left.mpn.localeCompare(right.mpn));
}
