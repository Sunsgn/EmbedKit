const SCHEMA = 'embedkit.storage-health';
const VERSION = 1;
import { STORAGE_HEALTH_RULES, type StorageShape } from '../infrastructure/persistence/storageRegistry';

type ExpectedShape = StorageShape;
export type StorageHealthReason = 'invalid-json' | 'unexpected-shape' | 'too-large' | 'unreadable';

const LABELS: Record<string, string> = { appearance: '外观与主题设置', 'tool-preferences': '工具收藏与最近使用', 'serial-settings': '串口显示设置', 'serial-shortcuts': '串口快捷指令', 'serial-shortcut-limit': '串口快捷指令数量', 'network-send-history': '网络发送历史', 'test-suites': '集成测试套件', 'learning-progress': '学习进度', 'build-analysis-records': '构建分析摘要', 'knowledge-experiences': '本地工程经验' };
const RULES = STORAGE_HEALTH_RULES.map(rule => ({ ...rule, label: LABELS[rule.label] ?? rule.label }));

export interface StorageHealthIssue {
  key: string;
  label: string;
  reason: StorageHealthReason;
  bytes: number | null;
}

export interface StorageHealthReport {
  schema: typeof SCHEMA;
  version: typeof VERSION;
  generatedAt: string;
  checked: number;
  issues: StorageHealthIssue[];
  privacy: string;
}

const byteLength = (value: string) => new TextEncoder().encode(value).byteLength;

function matchesShape(value: unknown, shape: ExpectedShape) {
  if (shape === 'array') return Array.isArray(value);
  if (shape === 'number') return typeof value === 'number' && Number.isFinite(value);
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function inspectStorageHealth(storage: Storage = localStorage, now = new Date()): StorageHealthReport {
  const issues: StorageHealthIssue[] = [];
  for (const rule of RULES) {
    let raw: string | null;
    try { raw = storage.getItem(rule.key); }
    catch { issues.push({ key: rule.key, label: rule.label, reason: 'unreadable', bytes: null }); continue; }
    if (raw === null) continue;
    const bytes = byteLength(raw);
    if (bytes > rule.maxBytes) { issues.push({ key: rule.key, label: rule.label, reason: 'too-large', bytes }); continue; }
    let value: unknown;
    try { value = JSON.parse(raw); }
    catch { issues.push({ key: rule.key, label: rule.label, reason: 'invalid-json', bytes }); continue; }
    if (!matchesShape(value, rule.shape)) issues.push({ key: rule.key, label: rule.label, reason: 'unexpected-shape', bytes });
  }
  return { schema: SCHEMA, version: VERSION, generatedAt: now.toISOString(), checked: RULES.length, issues, privacy: '仅记录配置键、分类和字节数，不包含配置值、源码、固件、路径、密钥或会话内容。' };
}

export function clearStillBrokenSettings(report: StorageHealthReport, storage: Storage = localStorage) {
  const currentBroken = new Set(inspectStorageHealth(storage).issues.map(issue => issue.key));
  let removed = 0;
  for (const issue of report.issues) {
    if (!currentBroken.has(issue.key)) continue;
    try { storage.removeItem(issue.key); removed += 1; } catch { /* Keep unreadable data untouched. */ }
  }
  return { removed, report: inspectStorageHealth(storage) };
}
