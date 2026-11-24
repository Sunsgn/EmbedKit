import { normalizeEngineeringProject } from '../../services/projectModel';
import { ENGINEERING_PROJECT_SCHEMA_VERSION, type EngineeringProject } from '../../types/product';

export const ENGINEERING_PROJECT_ARCHIVE_MAX_BYTES = 4 * 1024 * 1024;
export const ENGINEERING_PROJECT_ARCHIVE_SCHEMA = 'embedkit.engineering-project';
const LEGACY_SCHEMA = 'embedkit.device-project';

export function createEngineeringProjectArchive(project: EngineeringProject, exportedAt = new Date().toISOString()) {
  return JSON.stringify({
    schema: ENGINEERING_PROJECT_ARCHIVE_SCHEMA,
    version: ENGINEERING_PROJECT_SCHEMA_VERSION,
    exportedAt,
    project: { ...project, pathStatus: 'unverified' },
    privacy: { excluded: ['本机绝对路径', '目录授权令牌', '源码与构建产物内容'] },
  }, null, 2);
}

export function parseEngineeringProjectArchive(source: string, options: { id?: () => string; now?: () => string } = {}) {
  if (new Blob([source]).size > ENGINEERING_PROJECT_ARCHIVE_MAX_BYTES) throw new Error('工程档案超过 4 MiB 上限');
  let payload: { schema?: unknown; version?: unknown; project?: unknown };
  try { payload = JSON.parse(source) as typeof payload; } catch { throw new Error('工程档案不是有效的 JSON'); }
  const legacy = payload.schema === LEGACY_SCHEMA && (payload.version === 1 || payload.version === 2);
  const current = payload.schema === ENGINEERING_PROJECT_ARCHIVE_SCHEMA && (payload.version === 3 || payload.version === 4);
  if (!legacy && !current) throw new Error('不是受支持的工程档案文件');
  const normalized = normalizeEngineeringProject(payload.project);
  if (!normalized) throw new Error('工程档案内容无效或超过资源上限');
  const id = options.id ?? (() => crypto.randomUUID()), now = (options.now ?? (() => new Date().toISOString()))();
  const project: EngineeringProject = {
    ...normalized,
    id: id(),
    name: `${normalized.name}（导入）`,
    pathStatus: 'unverified',
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    features: (normalized.features ?? []).map(item => ({ ...item, id: id(), updatedAt: now })),
    environmentRequirements: (normalized.environmentRequirements ?? []).map(item => ({ ...item, id: id() })),
  };
  return { project, legacy };
}
