import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeMapInBackground, MAX_MAP_ANALYSIS_BYTES } from './mapAnalysisWorker';

const source = 'Memory Configuration\nFLASH 0x08000000 0x1000 xr\nLinker script and memory map\n.text 0x08000000 0x100';
const originalWorker = globalThis.Worker;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalWorker) globalThis.Worker = originalWorker;
  else Reflect.deleteProperty(globalThis, 'Worker');
});

describe('MAP background analysis', () => {
  it('degrades explicitly when Web Worker is unavailable', async () => {
    Reflect.deleteProperty(globalThis, 'Worker');
    const result = await analyzeMapInBackground(source);
    expect(result.execution).toBe('main-thread-fallback');
    expect(result.analysis.format).toBe('gnu');
  });

  it('uses and terminates a worker when supported', async () => {
    const terminate = vi.fn();
    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      terminate = terminate;
      postMessage() {
        queueMicrotask(() => this.onmessage?.({ data: { ok: true, analysis: { format: 'gnu' } } } as MessageEvent));
      }
    }
    globalThis.Worker = FakeWorker as unknown as typeof Worker;
    const result = await analyzeMapInBackground(source);
    expect(result.execution).toBe('worker');
    expect(result.analysis.format).toBe('gnu');
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('terminates an active worker when cancelled', async () => {
    const terminate = vi.fn();
    class PendingWorker {
      onmessage = null;
      onerror = null;
      terminate = terminate;
      postMessage() {}
    }
    globalThis.Worker = PendingWorker as unknown as typeof Worker;
    const controller = new AbortController();
    const pending = analyzeMapInBackground(source, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('terminates a worker that exceeds its deadline', async () => {
    const terminate = vi.fn();
    class PendingWorker {
      onmessage = null;
      onerror = null;
      terminate = terminate;
      postMessage() {}
    }
    globalThis.Worker = PendingWorker as unknown as typeof Worker;
    await expect(analyzeMapInBackground(source, { timeoutMs: 1 })).rejects.toThrow('已终止后台任务');
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('rejects oversized pasted input before starting a worker', async () => {
    await expect(analyzeMapInBackground('x'.repeat(MAX_MAP_ANALYSIS_BYTES + 1))).rejects.toThrow('16 MiB');
  });
});
