export const EXTENSION_MANIFEST_SCHEMA_VERSION = 1;
export const EXTENSION_API_VERSION = 1;
export const EXTENSION_REGISTRY_KEY = 'embedkit.extension-registry.v1';
export const EXTENSION_MANIFEST_MAX_BYTES = 512 * 1024;
export const EXTENSION_REGISTRY_LIMIT = 64;

export type ExtensionCapabilityKind = 'chip' | 'rtos' | 'ide' | 'toolchain' | 'map-format' | 'protocol' | 'tool';
export interface ExtensionCapability { id: string; kind: ExtensionCapabilityKind }
export interface ExtensionManifest { schemaVersion: 1; id: string; name: string; version: string; apiVersion: 1; description: string; scope: string; compatibility: string; capabilities: ExtensionCapability[]; testSamples: string[]; fallbackBehavior: string }

const identifier = (value: unknown, label: string) => { const text = typeof value === 'string' ? value.trim() : ''; if (!/^[a-z0-9][a-z0-9._-]{1,127}$/.test(text)) throw new Error(`${label}必须是 2～128 位小写稳定标识符`); return text; };
const bounded = (value: unknown, label: string, limit: number) => { const text = typeof value === 'string' ? value.trim() : ''; if (!text || text.length > limit) throw new Error(`${label}缺失或超过 ${limit} 字符上限`); return text; };
const semanticVersion = (value: unknown, label: string) => { const text = bounded(value, label, 64); if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(text)) throw new Error(`${label}必须使用语义化版本`); return text; };
const kinds = new Set<ExtensionCapabilityKind>(['chip', 'rtos', 'ide', 'toolchain', 'map-format', 'protocol', 'tool']);

export function normalizeExtensionManifest(value: unknown): ExtensionManifest {
  if (!value || typeof value !== 'object') throw new Error('扩展清单必须是对象');
  const input = value as Record<string, unknown>;
  if (input.schemaVersion !== EXTENSION_MANIFEST_SCHEMA_VERSION) throw new Error('不支持的扩展清单版本');
  if (input.apiVersion !== EXTENSION_API_VERSION) throw new Error(`扩展 API 版本不兼容：当前仅支持 ${EXTENSION_API_VERSION}`);
  if (!Array.isArray(input.capabilities) || input.capabilities.length < 1 || input.capabilities.length > 32) throw new Error('扩展必须声明 1～32 项能力');
  const capabilities = input.capabilities.map(value => { if (!value || typeof value !== 'object') throw new Error('扩展能力格式无效'); const item = value as Record<string, unknown>, kind = item.kind as ExtensionCapabilityKind; if (!kinds.has(kind)) throw new Error('扩展能力类型不受支持'); return { id: identifier(item.id, '能力 ID'), kind }; });
  if (!Array.isArray(input.testSamples) || input.testSamples.length < 1 || input.testSamples.length > 32) throw new Error('扩展必须声明 1～32 个测试样本');
  return { schemaVersion: 1, id: identifier(input.id, '扩展 ID'), name: bounded(input.name, '扩展名称', 200), version: semanticVersion(input.version, '扩展版本'), apiVersion: 1, description: bounded(input.description, '扩展说明', 2_000), scope: bounded(input.scope, '适用范围', 1_000), compatibility: bounded(input.compatibility, '兼容范围', 200), capabilities, testSamples: input.testSamples.map((sample, index) => bounded(sample, `测试样本 ${index + 1}`, 500)), fallbackBehavior: bounded(input.fallbackBehavior, '安全降级行为', 1_000) };
}

export function parseExtensionManifestFile(source: string) { if (new Blob([source]).size > EXTENSION_MANIFEST_MAX_BYTES) throw new Error('扩展清单超过 512 KiB 上限'); try { return normalizeExtensionManifest(JSON.parse(source)); } catch (reason) { if (reason instanceof SyntaxError) throw new Error('扩展清单不是有效的 JSON'); throw reason; } }
export function loadExtensionRegistry(storage: Pick<Storage, 'getItem'> = localStorage): ExtensionManifest[] { try { const value = JSON.parse(storage.getItem(EXTENSION_REGISTRY_KEY) || '[]'); if (!Array.isArray(value)) return []; return value.slice(0, EXTENSION_REGISTRY_LIMIT).flatMap(item => { try { return [normalizeExtensionManifest(item)]; } catch { return []; } }); } catch { return []; } }
function persist(items: ExtensionManifest[], storage: Pick<Storage, 'setItem'>) { storage.setItem(EXTENSION_REGISTRY_KEY, JSON.stringify(items)); return items; }
export function saveExtensionManifest(manifest: ExtensionManifest, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) { const current = loadExtensionRegistry(storage), next = [manifest, ...current.filter(item => item.id !== manifest.id)].slice(0, EXTENSION_REGISTRY_LIMIT); return persist(next, storage); }
export function removeExtensionManifest(id: string, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) { return persist(loadExtensionRegistry(storage).filter(item => item.id !== id), storage); }
export function exportExtensionRegistry(extensions: ExtensionManifest[], exportedAt = new Date().toISOString()) { return JSON.stringify({ schema: 'embedkit.extension-registry', version: 1, exportedAt, extensions }, null, 2); }
