import type { DeviceProject, TestRunRecord } from '../types/product';
import { exportProductData, mergeProductData, type ProductDataSnapshot } from './productStorage';

const SCHEMA = 'embedkit.workspace-backup';
const VERSION = 1;
export const WORKSPACE_BACKUP_MAX_BYTES = 16 * 1024 * 1024;
const MAX_LOCAL_VALUE_BYTES = 4 * 1024 * 1024;
const PORTABLE_LOCAL_KEYS = [
  'embedkit.tool-preferences',
  'embedkit.serial.settings',
  'embedkit.serial.shortcuts',
  'embedkit.serial.shortcut-limit',
  'embedkit.network.send-history',
  'embedkit.automation.suites',
  'embedkit-learning-progress',
  'embedkit.build-analysis-records',
] as const;

type PortableValue = null | boolean | number | string | PortableValue[] | { [key: string]: PortableValue };

export interface WorkspaceBackup {
  schema: typeof SCHEMA;
  version: typeof VERSION;
  createdAt: string;
  local: Partial<Record<(typeof PORTABLE_LOCAL_KEYS)[number], PortableValue>>;
  product: ProductDataSnapshot;
  privacy: {
    excluded: string[];
    note: string;
  };
}

export interface WorkspaceBackupPreview {
  projects: number;
  projectConflicts: number;
  runs: number;
  runConflicts: number;
  localSettings: number;
  localConflicts: number;
}

const encodedSize = (value: string) => new TextEncoder().encode(value).byteLength;
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function sanitize(value: unknown, key = ''): PortableValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return /(?:password|api.?key|token|credential)/i.test(key) ? '' : value;
  if (Array.isArray(value)) return value.slice(0, 10000).map(item => sanitize(item));
  if (!isObject(value)) return null;
  const secretVariable = value.secret === true;
  return Object.fromEntries(Object.entries(value).filter(([name]) => !/(?:selectionId|authorizationToken)/i.test(name)).map(([name, item]) => [name, secretVariable && name === 'value' ? '' : sanitize(item, name)]));
}

function readPortableLocal(storage: Storage) {
  const result: WorkspaceBackup['local'] = {};
  for (const key of PORTABLE_LOCAL_KEYS) {
    const raw = storage.getItem(key);
    if (raw === null || encodedSize(raw) > MAX_LOCAL_VALUE_BYTES) continue;
    try { result[key] = sanitize(JSON.parse(raw)); }
    catch { if (key === 'embedkit.serial.shortcut-limit') result[key] = raw.slice(0, 8); }
  }
  return result;
}

const validProject = (value: unknown): value is DeviceProject => isObject(value) && typeof value.id === 'string' && typeof value.name === 'string' && Array.isArray(value.devices) && typeof value.updatedAt === 'string';
const validRun = (value: unknown): value is TestRunRecord => isObject(value) && typeof value.id === 'string' && typeof value.startedAt === 'string' && typeof value.caseName === 'string' && Array.isArray(value.steps) && Array.isArray(value.logs);

export function parseWorkspaceBackup(text: string): WorkspaceBackup {
  if (encodedSize(text) > WORKSPACE_BACKUP_MAX_BYTES) throw new Error('备份文件超过 16 MiB 上限');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('备份文件不是有效 JSON'); }
  if (!isObject(value) || value.schema !== SCHEMA || value.version !== VERSION || !isObject(value.local) || !isObject(value.product)) throw new Error('备份格式或版本不受支持');
  const product = value.product, projects = product.projects, runs = product.runs, settings = product.settings;
  if (!Array.isArray(projects) || projects.length > 500 || !projects.every(validProject)) throw new Error('设备项目数据无效或超过 500 项');
  if (!Array.isArray(runs) || runs.length > 5000 || !runs.every(validRun)) throw new Error('测试记录数据无效或超过 5000 项');
  if (!Array.isArray(settings) || settings.length > 20 || !settings.every(item => isObject(item) && typeof item.key === 'string')) throw new Error('产品设置数据无效');
  const local = Object.fromEntries(Object.entries(value.local).filter(([key]) => (PORTABLE_LOCAL_KEYS as readonly string[]).includes(key)).map(([key, item]) => [key, sanitize(item)])) as WorkspaceBackup['local'];
  if (Object.values(local).some(item => encodedSize(JSON.stringify(item)) > MAX_LOCAL_VALUE_BYTES)) throw new Error('单项本地配置超过 4 MiB 上限');
  return { schema: SCHEMA, version: VERSION, createdAt: typeof value.createdAt === 'string' ? value.createdAt : '', local, product: { projects, runs, settings: settings as ProductDataSnapshot['settings'] }, privacy: { excluded: Array.isArray((value.privacy as Record<string, unknown> | undefined)?.excluded) ? (value.privacy as { excluded: string[] }).excluded : [], note: '导入前已重新执行字段白名单和秘密值清理。' } };
}

export async function createWorkspaceBackup(storage: Storage = localStorage): Promise<WorkspaceBackup> {
  return {
    schema: SCHEMA,
    version: VERSION,
    createdAt: new Date().toISOString(),
    local: readPortableLocal(storage),
    product: await exportProductData(),
    privacy: {
      excluded: ['工程源码与编辑器工作区', '运行轨迹原文', '固件/MAP/ELF 文件内容', '绝对构建路径与临时任务', 'AI 密钥、密码与授权令牌', '当前串口和网络会话'],
      note: '设备通信端点、设备标识和已脱敏的测试证据会保留，以便恢复真实开发工作流。',
    },
  };
}

export function previewWorkspaceBackup(backup: WorkspaceBackup, current: ProductDataSnapshot, storage: Storage = localStorage): WorkspaceBackupPreview {
  const projectIds = new Set(current.projects.map(item => item.id)), runIds = new Set(current.runs.map(item => item.id)), localKeys = Object.keys(backup.local);
  return { projects: backup.product.projects.length, projectConflicts: backup.product.projects.filter(item => projectIds.has(item.id)).length, runs: backup.product.runs.length, runConflicts: backup.product.runs.filter(item => runIds.has(item.id)).length, localSettings: localKeys.length, localConflicts: localKeys.filter(key => storage.getItem(key) !== null).length };
}

export async function applyWorkspaceBackup(backup: WorkspaceBackup, storage: Storage = localStorage, merge: (snapshot: ProductDataSnapshot) => Promise<void> = mergeProductData) {
  const previous = new Map<string, string | null>();
  try {
    for (const [key, value] of Object.entries(backup.local)) {
      previous.set(key, storage.getItem(key));
      storage.setItem(key, JSON.stringify(value));
    }
    await merge(backup.product);
  } catch (reason) {
    for (const [key, value] of previous) {
      if (value === null) storage.removeItem(key); else storage.setItem(key, value);
    }
    throw reason;
  }
}

export { exportProductData };
