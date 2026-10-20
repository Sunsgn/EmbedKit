import type { PartRecord } from './parts';

export const FUNCTION_SOLUTION_SCHEMA_VERSION = 2 as const;

export type SelectionValueType = 'number' | 'range' | 'enum' | 'boolean' | 'text';
export type ConstraintOperator =
  | 'equals'
  | 'not-equals'
  | 'at-least'
  | 'at-most'
  | 'greater-than'
  | 'less-than'
  | 'contains-range'
  | 'within-range'
  | 'contains-any'
  | 'contains-all'
  | 'supported'
  | 'unsupported'
  | 'manual-verification';
export type ConstraintPriority = 'required' | 'preferred' | 'reference' | 'undetermined';

export interface ParameterDefinition {
  schemaVersion: 1;
  id: string;
  categoryId: string;
  parameterKey: string;
  label: string;
  valueType: SelectionValueType;
  canonicalUnit?: string;
  allowedUnits?: string[];
  enumValues?: string[];
  supportedOperators: ConstraintOperator[];
  description: string;
}

export interface SelectionConstraint {
  id: string;
  parameterId?: string;
  parameterKey?: string;
  customName?: string;
  valueType: SelectionValueType;
  operator: ConstraintOperator;
  value?: string | number | boolean | string[];
  min?: number;
  max?: number;
  unit?: string;
  priority: ConstraintPriority;
  source: 'template' | 'user' | 'import';
}

export interface GlobalConstraint extends SelectionConstraint {
  appliesToRoleIds?: string[];
}

export interface PartRole {
  id: string;
  categoryId: string;
  name: string;
  purpose: string;
  constraints: SelectionConstraint[];
  candidatePartIds: string[];
  selectedPartId?: string;
}

export interface CompatibilityResult {
  id: string;
  ruleId: string;
  ruleVersion: number;
  roleIds: string[];
  outcome: 'compatible' | 'incompatible' | 'unknown' | 'not-applicable' | 'manual-verification';
  message: string;
  evidenceIds: string[];
}

export interface SolutionEvidence {
  verified: number;
  imported: number;
  unknown: number;
  conflict: number;
}

export interface FunctionSolution {
  schemaVersion: typeof FUNCTION_SOLUTION_SCHEMA_VERSION;
  id: string;
  name: string;
  description: string;
  templateId?: string;
  globalConstraints: GlobalConstraint[];
  roles: PartRole[];
  parts: PartRecord[];
  compatibilityResults: CompatibilityResult[];
  evidenceSummary: SolutionEvidence;
  migratedFrom?: { schemaVersion: number; recordId: string; scope: string };
  createdAt: string;
  updatedAt: string;
}

export interface FunctionTemplate {
  id: string;
  name: string;
  description: string;
  roles: Array<Pick<PartRole, 'categoryId' | 'name' | 'purpose'> & { constraints?: SelectionConstraint[] }>;
}

export interface UnitDefinition {
  symbol: string;
  dimension: 'frequency' | 'data-rate' | 'storage' | 'temperature' | 'voltage' | 'current' | 'time';
  toCanonical: (value: number) => number;
  fromCanonical: (value: number) => number;
}
