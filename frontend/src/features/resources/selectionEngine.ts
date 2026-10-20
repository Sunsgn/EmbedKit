import type { ConstraintPriority, PartParameter, PartParameterStatus, PartRecord, ParameterDefinition, SelectionConstraint } from '../../types';
import { convertUnit } from './selectionRegistry';

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
  .map(value => value.toLocaleLowerCase());

function constraintKey(constraint: SelectionConstraint, definitions: ParameterDefinition[]) {
  return constraint.parameterKey || definitions.find(item => item.id === constraint.parameterId)?.parameterKey;
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

function numericParameterValue(parameter: PartParameter) {
  if (typeof parameter.value === 'number') return parameter.value;
  return parameter.typical ?? parameter.max ?? parameter.min;
}

function evaluateDynamicCriterion(part: PartRecord, constraint: SelectionConstraint, definitions: ParameterDefinition[]): DynamicCriterionEvaluation {
  const definition = definitions.find(item => item.id === constraint.parameterId);
  const label = constraint.customName || definition?.label || constraint.parameterId || '自定义条件';
  if (constraint.priority === 'undetermined') return unknownDynamic(constraint, '条件尚未确定，不参与筛选');
  if (constraint.operator === 'manual-verification') return unknownDynamic(constraint, '该条件需要人工核验');
  const key = constraintKey(constraint, definitions);
  if (!key) return unknownDynamic(constraint, '自定义条件缺少参数键，不能与候选数据映射');
  const parameter = findParameter(part, key);
  if (!parameter || parameter.status === 'unknown' || parameter.status === 'conflict') return unknownDynamic(
    constraint,
    parameter?.status === 'conflict' ? '多个来源存在冲突，不能自动判断' : '候选缺少可靠参数，需要核验资料',
    parameter,
  );

  let matches: boolean;
  try {
    if (['at-least', 'at-most', 'greater-than', 'less-than'].includes(constraint.operator) ||
      (['equals', 'not-equals'].includes(constraint.operator) && typeof constraint.value === 'number')) {
      const available = numericParameterValue(parameter);
      if (available === undefined || typeof constraint.value !== 'number' || !Number.isFinite(constraint.value)) return unknownDynamic(constraint, '条件或候选不是可比较的有限数值', parameter);
      const normalized = convertUnit(available, parameter.unit, constraint.unit || definition?.canonicalUnit || parameter.unit);
      if (constraint.operator === 'at-least') matches = normalized >= constraint.value;
      else if (constraint.operator === 'at-most') matches = normalized <= constraint.value;
      else if (constraint.operator === 'greater-than') matches = normalized > constraint.value;
      else if (constraint.operator === 'less-than') matches = normalized < constraint.value;
      else if (constraint.operator === 'not-equals') matches = normalized !== constraint.value;
      else matches = normalized === constraint.value;
    } else if (constraint.operator === 'contains-range' || constraint.operator === 'within-range') {
      if (parameter.min === undefined || parameter.max === undefined || constraint.min === undefined || constraint.max === undefined || constraint.min > constraint.max) return unknownDynamic(constraint, '缺少有效的候选或目标范围', parameter);
      const targetUnit = constraint.unit || definition?.canonicalUnit || parameter.unit;
      const minimum = convertUnit(parameter.min, parameter.unit, targetUnit);
      const maximum = convertUnit(parameter.max, parameter.unit, targetUnit);
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
