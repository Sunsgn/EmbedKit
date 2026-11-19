import {
  PROJECT_ANALYSIS_RUN_SCHEMA_VERSION,
  type ProjectAnalysisConfidence,
  type ProjectAnalysisEvidence,
  type ProjectAnalysisFinding,
  type ProjectAnalysisRun,
} from '../types/projectAnalysis';

export const PROJECT_ANALYSIS_RUN_LIMIT = 1000;
export const PROJECT_ANALYSIS_EVIDENCE_LIMIT = 5000;
export const PROJECT_ANALYSIS_FINDING_LIMIT = 1000;
export const PROJECT_ANALYSIS_UNKNOWN_LIMIT = 500;

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown) => typeof value === 'string' && value.length <= 200 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) ? value : '';
const text = (value: unknown, limit: number) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const timestamp = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : '';
const sha256 = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value) ? value : '';
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : -1;
const confidence = (value: unknown): ProjectAnalysisConfidence | null => value === 'low' || value === 'medium' || value === 'high' ? value : null;

function parseEvidence(value: unknown): ProjectAnalysisEvidence | null {
  if (!isObject(value)) return null;
  const id = identifier(value.id), message = text(value.message, 2000), level = confidence(value.confidence);
  if (!id || !message || !level || !['source', 'project-config', 'runtime', 'calculation'].includes(String(value.kind))) return null;
  const file = text(value.file, 1000), line = count(value.line);
  return { id, kind: value.kind as ProjectAnalysisEvidence['kind'], message, confidence: level, ...(file ? { file } : {}), ...(line > 0 ? { line } : {}) };
}

function parseFinding(value: unknown, evidenceIds: Set<string>): ProjectAnalysisFinding | null {
  if (!isObject(value)) return null;
  const id = identifier(value.id), title = text(value.title, 500), recommendation = text(value.recommendation, 4000);
  const severity = value.severity, category = value.category;
  if (!id || !title || !recommendation || !['low', 'medium', 'high'].includes(String(severity)) || !['reliability', 'performance', 'memory', 'security', 'maintainability', 'structure'].includes(String(category)) || !Array.isArray(value.evidenceIds)) return null;
  const references = value.evidenceIds.map(identifier);
  if (references.some(reference => !reference || !evidenceIds.has(reference))) return null;
  return { id, severity: severity as ProjectAnalysisFinding['severity'], category: category as ProjectAnalysisFinding['category'], title, recommendation, evidenceIds: [...new Set(references)].slice(0, 100) };
}

export function parseProjectAnalysisRun(value: unknown): ProjectAnalysisRun | null {
  if (!isObject(value) || value.schemaVersion !== PROJECT_ANALYSIS_RUN_SCHEMA_VERSION) return null;
  const id = identifier(value.id), projectId = identifier(value.projectId), projectRevisionId = identifier(value.projectRevisionId);
  const sourceFingerprint = sha256(value.sourceFingerprint), inputFingerprint = sha256(value.inputFingerprint), startedAt = timestamp(value.startedAt), finishedAt = timestamp(value.finishedAt);
  if (!id || !projectId || !projectRevisionId || !sourceFingerprint || !inputFingerprint || !startedAt || !finishedAt || typeof value.dirty !== 'boolean' || !['completed', 'failed'].includes(String(value.status))) return null;
  if (Date.parse(finishedAt) < Date.parse(startedAt)) return null;
  if (!isObject(value.analyzer) || value.analyzer.name !== 'embedkit-deterministic-project-analysis' || !text(value.analyzer.version, 100)) return null;
  if (!isObject(value.framework) || !text(value.framework.name, 500) || !confidence(value.framework.confidence) || !Array.isArray(value.framework.evidenceIds)) return null;
  if (!isObject(value.coverage)) return null;
  const sourceFiles = count(value.coverage.sourceFiles), parsedFunctions = count(value.coverage.parsedFunctions), callSites = count(value.coverage.callSites), resolvedCallSites = count(value.coverage.resolvedCallSites), runtimeEvents = count(value.coverage.runtimeEvents), resolvedRate = Number(value.coverage.resolvedRate), runtimeRate = value.coverage.runtimeRate === undefined ? undefined : Number(value.coverage.runtimeRate);
  if ([sourceFiles, parsedFunctions, callSites, resolvedCallSites, runtimeEvents].some(item => item < 0) || !Number.isFinite(resolvedRate) || resolvedRate < 0 || resolvedRate > 1 || (runtimeRate !== undefined && (!Number.isFinite(runtimeRate) || runtimeRate < 0 || runtimeRate > 1))) return null;
  if (!Array.isArray(value.evidence) || value.evidence.length > PROJECT_ANALYSIS_EVIDENCE_LIMIT) return null;
  const evidence = value.evidence.map(parseEvidence);
  if (evidence.some(item => item === null)) return null;
  const evidenceRecords = evidence as ProjectAnalysisEvidence[], evidenceIds = new Set(evidenceRecords.map(item => item.id));
  if (evidenceIds.size !== evidenceRecords.length || !value.framework.evidenceIds.every(item => typeof item === 'string' && evidenceIds.has(item))) return null;
  if (!Array.isArray(value.findings) || value.findings.length > PROJECT_ANALYSIS_FINDING_LIMIT) return null;
  const findings = value.findings.map(item => parseFinding(item, evidenceIds));
  if (findings.some(item => item === null) || !Array.isArray(value.unknowns) || value.unknowns.length > PROJECT_ANALYSIS_UNKNOWN_LIMIT) return null;
  const unknowns = value.unknowns.map(item => text(item, 2000));
  if (unknowns.some(item => !item)) return null;
  const error = isObject(value.error) ? { code: identifier(value.error.code), message: text(value.error.message, 4000) } : undefined;
  if (value.status === 'failed' && (!error?.code || !error.message)) return null;
  return {
    schemaVersion: PROJECT_ANALYSIS_RUN_SCHEMA_VERSION,
    id, projectId, projectRevisionId, sourceFingerprint, inputFingerprint, dirty: value.dirty,
    status: value.status as ProjectAnalysisRun['status'], startedAt, finishedAt,
    analyzer: { name: 'embedkit-deterministic-project-analysis', version: text(value.analyzer.version, 100) },
    framework: { name: text(value.framework.name, 500), confidence: value.framework.confidence as ProjectAnalysisConfidence, evidenceIds: [...new Set(value.framework.evidenceIds as string[])].slice(0, 500) },
    coverage: { sourceFiles, parsedFunctions, callSites, resolvedCallSites, resolvedRate, runtimeEvents, ...(runtimeRate === undefined ? {} : { runtimeRate }) },
    findings: findings as ProjectAnalysisFinding[], unknowns: [...new Set(unknowns)], evidence: evidenceRecords,
    ...(error?.code && error.message ? { error } : {}),
  };
}

export function normalizeProjectAnalysisRuns(value: unknown): ProjectAnalysisRun[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, PROJECT_ANALYSIS_RUN_LIMIT).map(parseProjectAnalysisRun).filter((item): item is ProjectAnalysisRun => item !== null);
}
