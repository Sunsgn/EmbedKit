import { describe, expect, it } from 'vitest';
import { applyAppearance, DEFAULT_APPEARANCE, loadAppearance, normalizeAppearance, saveAppearance } from './appearance';

describe('appearance settings', () => {
  it('safely migrates incomplete and invalid stored values', () => {
    expect(normalizeAppearance({ colorMode: 'light', accent: 'unknown', reduceMotion: true })).toEqual({
      ...DEFAULT_APPEARANCE,
      colorMode: 'light',
      reduceMotion: true,
    });
    expect(loadAppearance({ getItem: () => '{broken' })).toEqual(DEFAULT_APPEARANCE);
  });

  it('reports storage failures without losing the active selection', () => {
    expect(saveAppearance({ ...DEFAULT_APPEARANCE, accent: 'cyan' }, { setItem: () => { throw new Error('quota'); } })).toBe(false);
  });

  it('resolves system mode and applies portable data attributes', () => {
    const root = document.createElement('div');
    applyAppearance({ ...DEFAULT_APPEARANCE, colorMode: 'system', darkSurface: 'navy', accent: 'emerald', reduceMotion: true }, root, false);
    expect(root.dataset).toMatchObject({ themeMode: 'system', colorMode: 'light', darkSurface: 'navy', accent: 'emerald', reduceMotion: 'true' });
    expect(root.style.colorScheme).toBe('light');
  });
});
