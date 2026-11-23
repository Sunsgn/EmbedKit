import { describe, expect, it, vi } from 'vitest';
import type { FileNode } from '../../types';
import type { AiConfig } from '../../types/ai';
import type { ProjectSummary } from './projectSummary';
import { buildProjectAiPrompt, runProjectAiAnalysis } from './projectAiAnalysisController';

const summary = { chip: 'UNKNOWN', toolchain: '未识别', sdk: '未识别', findings: [] } as unknown as ProjectSummary;
const file = (name: string, content: string): FileNode => ({ name, path: `/${name}`, content, language: 'text' });
const callbacks = () => ({ confirmExternal: vi.fn(() => true), onStart: vi.fn(), onChunk: vi.fn(), onDone: vi.fn(), onError: vi.fn() });

describe('project AI analysis controller', () => {
  it('limits source evidence to supported files, 12 KB per file, and 50 KB total', () => {
    const prompt = buildProjectAiPrompt([
      file('a.c', 'A'.repeat(20000)), file('b.cpp', 'B'.repeat(20000)), file('c.h', 'C'.repeat(20000)), file('notes.md', 'PRIVATE-NOTES'),
      file('d.c', 'D'.repeat(20000)), file('e.c', 'E'.repeat(20000)),
    ], summary);
    const source = prompt.split('源码片段：')[1].split('\n\n请用中文输出：')[0];
    expect(source.length).toBe(50000);
    expect(source).not.toContain('PRIVATE-NOTES');
    expect(source).not.toContain('A'.repeat(12001));
  });

  it('falls back to the local model when stored configuration cannot be read', async () => {
    const stream = vi.fn(async (config, _messages, _chunk, done) => { expect(config.provider).toBe('local'); done(); });
    const ui = callbacks();
    await expect(runProjectAiAnalysis([file('main.c', 'int main() {}')], summary, ui, {
      loadConfig: () => { throw new Error('damaged storage'); }, proxyUrl: target => `proxy:${target}`, stream,
    })).resolves.toEqual({ status: 'started' });
    expect(ui.confirmExternal).not.toHaveBeenCalled();
    expect(ui.onStart).toHaveBeenCalledOnce();
  });

  it('does not use an incomplete remote configuration or simulated response', async () => {
    const stream = vi.fn(), ui = callbacks();
    const invalid = { provider: 'openrouter', model: 'model', apiKey: '' } as AiConfig;
    const result = await runProjectAiAnalysis([], summary, ui, { loadConfig: () => invalid, stream });
    expect(result).toMatchObject({ status: 'unavailable' });
    expect(stream).not.toHaveBeenCalled();
    expect(ui.onStart).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation before sending evidence to an external provider', async () => {
    const ui = callbacks(); ui.confirmExternal.mockReturnValue(false);
    const config = { provider: 'openrouter', model: 'model', apiKey: 'secret' } as AiConfig;
    const stream = vi.fn();
    await expect(runProjectAiAnalysis([], summary, ui, { loadConfig: () => config, stream })).resolves.toEqual({ status: 'cancelled' });
    expect(ui.confirmExternal).toHaveBeenCalledWith(expect.stringContaining('最多 50 KB'));
    expect(stream).not.toHaveBeenCalled();
  });

  it('forwards stream chunks, completion, and deterministic prompt boundaries', async () => {
    const ui = callbacks(), config = { provider: 'openrouter', model: 'model', apiKey: 'secret' } as AiConfig;
    const stream = vi.fn(async (_config, messages, chunk, done) => { expect(messages[0].content).toContain('不要臆测'); chunk('answer'); done(); });
    await runProjectAiAnalysis([file('main.c', 'int main() {}')], summary, ui, { loadConfig: () => config, stream });
    expect(ui.onChunk).toHaveBeenCalledWith('answer');
    expect(ui.onDone).toHaveBeenCalledOnce();
  });

  it('forwards provider failures without generating fallback content', async () => {
    const ui = callbacks(), config = { provider: 'openrouter', model: 'model', apiKey: 'secret' } as AiConfig;
    const stream = vi.fn(async (_config, _messages, _chunk, _done, error) => error('network denied'));
    await runProjectAiAnalysis([], summary, ui, { loadConfig: () => config, stream });
    expect(ui.onError).toHaveBeenCalledWith('network denied');
    expect(ui.onChunk).not.toHaveBeenCalled();
  });
});
