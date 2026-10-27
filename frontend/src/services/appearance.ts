export const APPEARANCE_STORAGE_KEY = 'embedkit.appearance';

export type ColorMode = 'system' | 'light' | 'dark';
export type DarkSurface = 'midnight' | 'graphite' | 'navy';
export type AccentColor = 'blue' | 'cyan' | 'emerald' | 'violet' | 'orange';

export interface AppearanceSettings {
  schema: 'embedkit.appearance';
  version: 1;
  colorMode: ColorMode;
  darkSurface: DarkSurface;
  accent: AccentColor;
  reduceMotion: boolean;
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  schema: 'embedkit.appearance',
  version: 1,
  colorMode: 'system',
  darkSurface: 'midnight',
  accent: 'blue',
  reduceMotion: false,
};

const colorModes = new Set<ColorMode>(['system', 'light', 'dark']);
const darkSurfaces = new Set<DarkSurface>(['midnight', 'graphite', 'navy']);
const accents = new Set<AccentColor>(['blue', 'cyan', 'emerald', 'violet', 'orange']);
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function normalizeAppearance(value: unknown): AppearanceSettings {
  if (!isRecord(value)) return { ...DEFAULT_APPEARANCE };
  return {
    ...DEFAULT_APPEARANCE,
    colorMode: colorModes.has(value.colorMode as ColorMode) ? value.colorMode as ColorMode : DEFAULT_APPEARANCE.colorMode,
    darkSurface: darkSurfaces.has(value.darkSurface as DarkSurface) ? value.darkSurface as DarkSurface : DEFAULT_APPEARANCE.darkSurface,
    accent: accents.has(value.accent as AccentColor) ? value.accent as AccentColor : DEFAULT_APPEARANCE.accent,
    reduceMotion: typeof value.reduceMotion === 'boolean' ? value.reduceMotion : DEFAULT_APPEARANCE.reduceMotion,
  };
}

export function loadAppearance(storage: Pick<Storage, 'getItem'> = localStorage): AppearanceSettings {
  try {
    const raw = storage.getItem(APPEARANCE_STORAGE_KEY);
    return raw ? normalizeAppearance(JSON.parse(raw)) : { ...DEFAULT_APPEARANCE };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function saveAppearance(settings: AppearanceSettings, storage: Pick<Storage, 'setItem'> = localStorage) {
  try {
    storage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(normalizeAppearance(settings)));
    return true;
  } catch {
    return false;
  }
}

export function prefersDarkMode() {
  return typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true;
}

export function applyAppearance(settings: AppearanceSettings, root: HTMLElement = document.documentElement, prefersDark = prefersDarkMode()) {
  const normalized = normalizeAppearance(settings);
  const resolvedMode = normalized.colorMode === 'system' ? (prefersDark ? 'dark' : 'light') : normalized.colorMode;
  root.dataset.themeMode = normalized.colorMode;
  root.dataset.colorMode = resolvedMode;
  root.dataset.darkSurface = normalized.darkSurface;
  root.dataset.accent = normalized.accent;
  root.dataset.reduceMotion = String(normalized.reduceMotion);
  root.style.colorScheme = resolvedMode;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', resolvedMode === 'light' ? '#f8fafc' : '#0d1117');
}

export function applyStoredAppearance() {
  const settings = loadAppearance();
  applyAppearance(settings);
  return settings;
}
