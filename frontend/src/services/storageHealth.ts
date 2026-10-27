const SCHEMA = 'embedkit.storage-health';
const VERSION = 1;
const MAX_VALUE_BYTES = 4 * 1024 * 1024;

type ExpectedShape = 'object' | 'array' | 'number';
export type StorageHealthReason = 'invalid-json' | 'unexpected-shape' | 'too-large' | 'unreadable';

interface StorageRule {
  key: string;
  label: string;
  shape: ExpectedShape;
}

const RULES: StorageRule[] = [
  { key: 'embedkit.appearance', label: '外观与主题设置', shape: 'object' },
  { key: 'embedkit.tool-preferences', label: '工具收藏与最近使用', shape: 'object' },
  { key: 'embedkit.serial.settings', label: '串口显示设置', shape: 'object' },
  { key: 'embedkit.serial.shortcuts', label: '串口快捷指令', shape: 'array' },
  { key: 'embedkit.serial.shortcut-limit', label: '串口快捷指令数量', shape: 'number' },
  { key: 'embedkit.network.send-history', label: '网络发送历史', shape: 'array' },
  { key: 'embedkit.automation.suites', label: '集成测试套件', shape: 'array' },
  { key: 'embedkit-learning-progress', label: '学习进度', shape: 'object' },
  { key: 'embedkit.build-analysis-records', label: '构建分析摘要', shape: 'array' },
];

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
    if (bytes > MAX_VALUE_BYTES) { issues.push({ key: rule.key, label: rule.label, reason: 'too-large', bytes }); continue; }
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
