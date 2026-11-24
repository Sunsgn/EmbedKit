export interface CommunicationShortcut {
  id: number;
  name: string;
  value: string;
  hex: boolean;
  intervalMs: number;
}

export const COMMUNICATION_SHORTCUTS_KEY = 'embedkit.serial.shortcuts';
export const COMMUNICATION_SHORTCUT_LIMIT_KEY = 'embedkit.serial.shortcut-limit';

export function loadCommunicationShortcuts(storage: Pick<Storage, 'getItem'> = localStorage): CommunicationShortcut[] {
  try {
    const parsed = JSON.parse(storage.getItem(COMMUNICATION_SHORTCUTS_KEY) || '[]') as Array<Partial<CommunicationShortcut>>;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item.name && item.value).slice(0, 100).map(item => ({
      id: Number(item.id) || Date.now() + Math.random(),
      name: String(item.name),
      value: String(item.value),
      hex: item.hex === true,
      intervalMs: Math.max(100, Math.min(60000, Number(item.intervalMs) || 1000)),
    }));
  } catch { return []; }
}

export function loadCommunicationShortcutLimit(storage: Pick<Storage, 'getItem'> = localStorage) {
  return Math.max(1, Math.min(100, Number(storage.getItem(COMMUNICATION_SHORTCUT_LIMIT_KEY)) || 20));
}

export function saveCommunicationShortcuts(shortcuts: CommunicationShortcut[], storage: Pick<Storage, 'setItem'> = localStorage) {
  const bounded = shortcuts.slice(0, 100).map(item => ({ ...item, name: item.name.slice(0, 200), value: item.value.slice(0, 65_536), intervalMs: Math.max(100, Math.min(60_000, Number(item.intervalMs) || 1_000)) }));
  storage.setItem(COMMUNICATION_SHORTCUTS_KEY, JSON.stringify(bounded));
}

export function saveCommunicationShortcutLimit(limit: number, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(COMMUNICATION_SHORTCUT_LIMIT_KEY, String(Math.max(1, Math.min(100, Math.round(limit) || 20))));
}
