const STORAGE_KEY = 'embedkit.tool-preferences';
const SCHEMA = 'embedkit.tool-preferences';
const VERSION = 1;
const RECENT_LIMIT = 8;

export interface ToolPreferences {
  schema: typeof SCHEMA;
  version: typeof VERSION;
  favorites: string[];
  recent: string[];
}

const emptyPreferences = (): ToolPreferences => ({ schema: SCHEMA, version: VERSION, favorites: [], recent: [] });
const uniqueIds = (value: unknown) => Array.isArray(value) ? [...new Set(value.filter(item => typeof item === 'string' && item.trim()))] : [];

export function loadToolPreferences(): ToolPreferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<ToolPreferences> | null;
    if (!parsed || parsed.schema !== SCHEMA || parsed.version !== VERSION) return emptyPreferences();
    return { schema: SCHEMA, version: VERSION, favorites: uniqueIds(parsed.favorites), recent: uniqueIds(parsed.recent).slice(0, RECENT_LIMIT) };
  } catch {
    return emptyPreferences();
  }
}

function saveToolPreferences(preferences: ToolPreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  return preferences;
}

export function toggleToolFavorite(toolId: string) {
  const current = loadToolPreferences(), active = current.favorites.includes(toolId);
  return saveToolPreferences({ ...current, favorites: active ? current.favorites.filter(id => id !== toolId) : [...current.favorites, toolId] });
}

export function recordRecentTool(toolId: string) {
  const current = loadToolPreferences();
  return saveToolPreferences({ ...current, recent: [toolId, ...current.recent.filter(id => id !== toolId)].slice(0, RECENT_LIMIT) });
}
