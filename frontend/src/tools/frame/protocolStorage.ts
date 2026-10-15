import { normalizeProtocolDefinition, type ProtocolDefinition } from './protocolDocument';

const STORAGE_KEY = 'embedkit.protocol-definitions';
const MAX_PROTOCOLS = 50;

export function listProtocolDefinitions(storage: Storage = localStorage): ProtocolDefinition[] {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeProtocolDefinition).filter((item): item is ProtocolDefinition => item !== null).slice(0, MAX_PROTOCOLS).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch { return []; }
}

export function saveProtocolDefinition(value: ProtocolDefinition, storage: Storage = localStorage) {
  const normalized = normalizeProtocolDefinition(value); if (!normalized || normalized.status !== 'confirmed') throw new Error('只能保存已经人工确认的有效协议模型');
  const rest = listProtocolDefinitions(storage).filter(item => item.id !== normalized.id);
  storage.setItem(STORAGE_KEY, JSON.stringify([normalized, ...rest].slice(0, MAX_PROTOCOLS)));
  return normalized;
}

export function deleteProtocolDefinition(id: string, storage: Storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(listProtocolDefinitions(storage).filter(item => item.id !== id)));
}
