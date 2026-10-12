export type BuildAnalysisKind = 'elf' | 'map' | 'bin' | 'hex';
export interface BuildArtifactRouteState { selectionId: string; fileName: string; source: 'build-artifact'; buildId?: string; artifactIndex?: number; artifactType?: string; size?: number; modifiedAt?: string; sha256?: string }
export interface BuildAnalysisContext { buildId: string; artifactIndex: number; fileName: string; artifactType: string; size: number; modifiedAt: string; sha256?: string }
export interface BuildAnalysisRecord extends BuildAnalysisContext { schemaVersion: 1; id: string; kind: BuildAnalysisKind; status: 'passed' | 'failed'; analyzedAt: string; summary?: Record<string, string | number | boolean | null>; error?: string }

const STORAGE_KEY = 'embedkit.build-analysis-records';
const MAX_RECORDS = 100;
const basename = (value: string) => value.split(/[\\/]/).filter(Boolean).pop() || 'artifact';
const isContext = (value: Partial<BuildAnalysisContext>): value is BuildAnalysisContext => typeof value.buildId === 'string' && value.buildId.length > 0 && Number.isInteger(value.artifactIndex) && Number(value.artifactIndex) >= 0 && typeof value.fileName === 'string' && typeof value.artifactType === 'string' && Number.isFinite(value.size) && Number(value.size) >= 0 && typeof value.modifiedAt === 'string';

function parseRecord(value: unknown): BuildAnalysisRecord | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<BuildAnalysisRecord>;
  if (item.schemaVersion !== 1 || !['elf', 'map', 'bin', 'hex'].includes(String(item.kind)) || !['passed', 'failed'].includes(String(item.status)) || typeof item.analyzedAt !== 'string' || !isContext(item)) return null;
  return { ...item, id: `${item.buildId}:${item.artifactIndex}`, fileName: basename(item.fileName), schemaVersion: 1 } as BuildAnalysisRecord;
}

export function parseBuildArtifactRouteState(value: unknown): BuildArtifactRouteState | null {
  if (!value || typeof value !== 'object') return null; const item = value as Partial<BuildArtifactRouteState>;
  if (item.source !== 'build-artifact' || typeof item.selectionId !== 'string' || !item.selectionId || typeof item.fileName !== 'string') return null;
  return item as BuildArtifactRouteState;
}

export function routeStateContext(state: BuildArtifactRouteState | null): BuildAnalysisContext | null {
  if (!state || !isContext({ buildId: state.buildId, artifactIndex: state.artifactIndex, fileName: state.fileName, artifactType: state.artifactType, size: state.size, modifiedAt: state.modifiedAt, sha256: state.sha256 })) return null;
  return { buildId: state.buildId!, artifactIndex: state.artifactIndex!, fileName: basename(state.fileName), artifactType: state.artifactType!, size: state.size!, modifiedAt: state.modifiedAt!, ...(state.sha256 ? { sha256: state.sha256 } : {}) };
}

export function listBuildAnalysisRecords(buildId?: string) {
  try { const values = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as unknown[]; return values.map(parseRecord).filter((item): item is BuildAnalysisRecord => Boolean(item)).filter(item => !buildId || item.buildId === buildId).sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt)); } catch { return []; }
}

export function saveBuildAnalysisRecord(context: BuildAnalysisContext, kind: BuildAnalysisKind, result: { summary?: BuildAnalysisRecord['summary']; error?: string }, analyzedAt = new Date().toISOString()) {
  if (!isContext(context)) throw new Error('构建产物关联信息不完整');
  const record: BuildAnalysisRecord = { schemaVersion: 1, id: `${context.buildId}:${context.artifactIndex}`, ...context, fileName: basename(context.fileName), kind, status: result.error ? 'failed' : 'passed', analyzedAt, ...(result.summary ? { summary: result.summary } : {}), ...(result.error ? { error: result.error.slice(0, 500) } : {}) };
  const records = listBuildAnalysisRecords().filter(item => item.id !== record.id); records.unshift(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS))); return record;
}

export function createBuildAnalysisReport(buildId: string, generatedAt = new Date().toISOString()) {
  const records = listBuildAnalysisRecords(buildId);
  const grouped = new Map<string, BuildAnalysisRecord[]>();
  for (const record of records) { const stem = record.fileName.replace(/\.(?:elf|axf|out|map|bin|hex)$/i, '').toLowerCase(); grouped.set(stem, [...(grouped.get(stem) || []), record]); }
  const associations = [...grouped.entries()].filter(([, items]) => items.length > 1).map(([stem, items]) => ({ id: `stem:${stem}`, label: stem, artifactIds: items.map(item => item.id), types: [...new Set(items.map(item => item.artifactType))], basis: 'same-build-id-and-filename-stem', confidence: 'medium' as const, note: '文件名关联是候选关系；只有内容指纹、ELF 段或 MAP 地址范围等额外证据才能提升可信度。' }));
  return { schema: 'embedkit.build-analysis-report', version: 1, generatedAt, buildId, summary: { artifacts: records.length, passed: records.filter(item => item.status === 'passed').length, failed: records.filter(item => item.status === 'failed').length, associations: associations.length }, artifacts: records, associations, privacy: 'Source text, firmware bytes, absolute paths, and authorization tokens are omitted.' };
}
