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
