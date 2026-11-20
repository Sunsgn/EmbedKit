export type StorageEngine = 'localStorage' | 'sessionStorage' | 'indexedDB';
export type StorageShape = 'object' | 'array' | 'number';
export type BackupPolicy = 'portable' | 'excluded' | 'domain-export';

export interface StorageRegistration {
  id: string;
  engine: StorageEngine;
  location: string;
  schemaVersion: number;
  owner: string;
  backup: BackupPolicy;
  maxBytes?: number;
  maxRecords?: number;
  shape?: StorageShape;
  healthCheck?: boolean;
  exclusionReason?: string;
}

const MIB = 1024 * 1024;

export const STORAGE_REGISTRY = [
  { id: 'product', engine: 'indexedDB', location: 'embedkit-product', schemaVersion: 5, owner: 'product-lifecycle', backup: 'domain-export', maxRecords: 5000 },
  { id: 'project-workspaces', engine: 'indexedDB', location: 'embedkit-workspaces', schemaVersion: 1, owner: 'project-analysis', backup: 'excluded', exclusionReason: '包含本地源码工作区，默认不进入便携备份' },
  { id: 'runtime-traces', engine: 'indexedDB', location: 'embedkit-runtime-traces', schemaVersion: 1, owner: 'project-analysis', backup: 'excluded', exclusionReason: '原始运行轨迹可能较大且可能包含敏感设备数据' },
  { id: 'fault-investigations', engine: 'indexedDB', location: 'embedkit-fault-investigations', schemaVersion: 1, owner: 'fault-investigation', backup: 'excluded', exclusionReason: '由故障调查报告执行显式导出' },
  { id: 'knowledge-documents', engine: 'indexedDB', location: 'embedkit-knowledge-documents', schemaVersion: 1, owner: 'resource-center', backup: 'excluded', exclusionReason: '本地文档二进制不进入默认备份' },
  { id: 'part-documents', engine: 'indexedDB', location: 'embedkit-part-documents', schemaVersion: 2, owner: 'resource-center', backup: 'excluded', exclusionReason: '本地或在线文档二进制不进入默认备份' },

  { id: 'appearance', engine: 'localStorage', location: 'embedkit.appearance', schemaVersion: 1, owner: 'application-shell', backup: 'portable', maxBytes: 4 * MIB, shape: 'object', healthCheck: true },
  { id: 'tool-preferences', engine: 'localStorage', location: 'embedkit.tool-preferences', schemaVersion: 1, owner: 'toolbox', backup: 'portable', maxBytes: 4 * MIB, shape: 'object', healthCheck: true },
  { id: 'serial-settings', engine: 'localStorage', location: 'embedkit.serial.settings', schemaVersion: 3, owner: 'communication', backup: 'portable', maxBytes: 4 * MIB, shape: 'object', healthCheck: true },
  { id: 'serial-shortcuts', engine: 'localStorage', location: 'embedkit.serial.shortcuts', schemaVersion: 1, owner: 'communication', backup: 'portable', maxBytes: 4 * MIB, maxRecords: 100, shape: 'array', healthCheck: true },
  { id: 'serial-shortcut-limit', engine: 'localStorage', location: 'embedkit.serial.shortcut-limit', schemaVersion: 1, owner: 'communication', backup: 'portable', maxBytes: 8, shape: 'number', healthCheck: true },
  { id: 'network-send-history', engine: 'localStorage', location: 'embedkit.network.send-history', schemaVersion: 1, owner: 'communication', backup: 'portable', maxBytes: 4 * MIB, shape: 'array', healthCheck: true },
  { id: 'test-suites', engine: 'localStorage', location: 'embedkit.automation.suites', schemaVersion: 1, owner: 'test-automation', backup: 'portable', maxBytes: 4 * MIB, shape: 'array', healthCheck: true },
  { id: 'learning-progress', engine: 'localStorage', location: 'embedkit-learning-progress', schemaVersion: 1, owner: 'learning-center', backup: 'portable', maxBytes: 4 * MIB, shape: 'object', healthCheck: true },
  { id: 'build-analysis-records', engine: 'localStorage', location: 'embedkit.build-analysis-records', schemaVersion: 1, owner: 'build-analysis', backup: 'portable', maxBytes: 4 * MIB, shape: 'array', healthCheck: true },
  { id: 'part-selection-records', engine: 'localStorage', location: 'embedkit.part-selection-records', schemaVersion: 1, owner: 'resource-center', backup: 'portable', maxBytes: 4 * MIB, shape: 'array' },
  { id: 'knowledge-experiences', engine: 'localStorage', location: 'embedkit.knowledge-experiences', schemaVersion: 1, owner: 'resource-center', backup: 'portable', maxBytes: 4 * MIB, shape: 'object', healthCheck: true },

  { id: 'ai-config', engine: 'localStorage', location: 'embedkit-ai-config', schemaVersion: 1, owner: 'ai-assistant', backup: 'excluded', exclusionReason: 'AI 端点配置可能包含敏感信息' },
  { id: 'project-local-bindings', engine: 'localStorage', location: 'embedkit.project-local-bindings', schemaVersion: 1, owner: 'project-analysis', backup: 'excluded', exclusionReason: '包含本机绝对路径' },
  { id: 'project-build-config', engine: 'localStorage', location: 'embedkit.project-build-config', schemaVersion: 1, owner: 'build-integration', backup: 'excluded', exclusionReason: '包含本机工具和工程路径' },
  { id: 'project-build-last-job', engine: 'localStorage', location: 'embedkit.project-build-last-job', schemaVersion: 1, owner: 'build-integration', backup: 'excluded', exclusionReason: 'Local Agent 临时任务标识不可跨环境恢复' },
  { id: 'test-serial-config', engine: 'localStorage', location: 'embedkit.automation.serial-config.v1', schemaVersion: 1, owner: 'test-automation', backup: 'excluded', exclusionReason: '端口名属于本机资源，导入后必须重新确认' },
  { id: 'protocol-definitions', engine: 'localStorage', location: 'embedkit.protocol-definitions', schemaVersion: 2, owner: 'protocol-tools', backup: 'domain-export', maxBytes: 4 * MIB },
  { id: 'function-solutions', engine: 'localStorage', location: 'embedkit.function-solutions', schemaVersion: 1, owner: 'resource-center', backup: 'domain-export', maxBytes: 4 * MIB },

  { id: 'ai-secrets', engine: 'sessionStorage', location: 'embedkit-ai-secrets', schemaVersion: 1, owner: 'ai-assistant', backup: 'excluded', exclusionReason: '会话密钥永不导出' },
  { id: 'communication-capture-handoff', engine: 'sessionStorage', location: 'embedkit.communication-capture.pending', schemaVersion: 1, owner: 'communication', backup: 'excluded', exclusionReason: '一次性跨页面交接数据' },
  { id: 'test-session-handoff', engine: 'sessionStorage', location: 'embedkit.test-session-handoff.pending', schemaVersion: 1, owner: 'test-automation', backup: 'excluded', exclusionReason: '活动硬件会话不可跨环境恢复' },
] as const satisfies readonly StorageRegistration[];

export type RegisteredLocalStorageKey = Extract<(typeof STORAGE_REGISTRY)[number], { engine: 'localStorage' }>['location'];

const registrations: readonly StorageRegistration[] = STORAGE_REGISTRY;

export const PORTABLE_LOCAL_STORAGE_KEYS = registrations
  .filter(item => item.engine === 'localStorage' && item.backup === 'portable')
  .map(item => item.location) as RegisteredLocalStorageKey[];

export const STORAGE_HEALTH_RULES = registrations
  .filter(item => item.engine === 'localStorage' && item.healthCheck && item.shape)
  .map(item => ({ key: item.location, label: item.id, shape: item.shape!, maxBytes: item.maxBytes ?? 4 * MIB }));

export function validateStorageRegistry(registry: readonly StorageRegistration[] = STORAGE_REGISTRY) {
  const ids = new Set<string>(), locations = new Set<string>();
  for (const item of registry) {
    if (ids.has(item.id)) throw new Error(`存储注册 ID 重复：${item.id}`);
    const locationKey = `${item.engine}:${item.location}`;
    if (locations.has(locationKey)) throw new Error(`存储位置重复登记：${locationKey}`);
    if (!Number.isInteger(item.schemaVersion) || item.schemaVersion < 1) throw new Error(`存储版本无效：${item.id}`);
    if (item.backup === 'excluded' && !item.exclusionReason) throw new Error(`排除备份的数据必须说明原因：${item.id}`);
    ids.add(item.id); locations.add(locationKey);
  }
  return { stores: registry.length, portable: registry.filter(item => item.backup === 'portable').length };
}
