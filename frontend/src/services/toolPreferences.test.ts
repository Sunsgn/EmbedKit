import { describe, expect, it } from 'vitest';
import { loadToolPreferences, recordRecentTool, toggleToolFavorite } from './toolPreferences';

describe('tool preferences', () => {
  it('falls back safely when local data is damaged', () => {
    localStorage.setItem('embedkit.tool-preferences', '{broken');
    expect(loadToolPreferences()).toMatchObject({ version: 1, favorites: [], recent: [] });
  });

  it('persists favorites without duplicates', () => {
    toggleToolFavorite('crc');
    expect(loadToolPreferences().favorites).toEqual(['crc']);
    toggleToolFavorite('crc');
    expect(loadToolPreferences().favorites).toEqual([]);
  });

  it('keeps the latest unique tools in bounded order', () => {
    for (let index = 0; index < 10; index += 1) recordRecentTool(`tool-${index}`);
    recordRecentTool('tool-5');
    expect(loadToolPreferences().recent).toEqual(['tool-5', 'tool-9', 'tool-8', 'tool-7', 'tool-6', 'tool-4', 'tool-3', 'tool-2']);
  });
});
