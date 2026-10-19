import type { PartParameter, PartParameterStatus, PartRecord } from '../../types';

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
