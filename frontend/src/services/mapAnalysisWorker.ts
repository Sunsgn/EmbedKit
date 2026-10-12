import { analyzeMap, type MapAnalysis } from '../utils/mapAnalyzer';

export const MAX_MAP_ANALYSIS_BYTES = 16 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;

export interface MapAnalysisResult {
  analysis: MapAnalysis;
  execution: 'worker' | 'main-thread-fallback';
}

export interface MapAnalysisOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

const cancelled = () => new DOMException('MAP 分析已取消', 'AbortError');
const analyzeWithoutWorker = (source: string, signal?: AbortSignal): Promise<MapAnalysisResult> => Promise.resolve().then(() => {
  if (signal?.aborted) throw cancelled();
  const analysis = analyzeMap(source);
  if (signal?.aborted) throw cancelled();
  return { analysis, execution: 'main-thread-fallback' };
});

export function analyzeMapInBackground(source: string, options: MapAnalysisOptions = {}): Promise<MapAnalysisResult> {
  if (source.length > MAX_MAP_ANALYSIS_BYTES || new TextEncoder().encode(source).byteLength > MAX_MAP_ANALYSIS_BYTES) {
    return Promise.reject(new Error('MAP 内容超过 16 MiB 分析上限'));
  }
  if (options.signal?.aborted) return Promise.reject(cancelled());

  if (typeof Worker === 'undefined') return analyzeWithoutWorker(source, options.signal);

  let worker: Worker;
  try {
    worker = new Worker(new URL('../workers/mapAnalysis.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return analyzeWithoutWorker(source, options.signal);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
      worker.terminate();
      callback();
    };
    const abort = () => finish(() => reject(cancelled()));
    const timeout = window.setTimeout(
      () => finish(() => reject(new Error(`MAP 分析超过 ${options.timeoutMs ?? DEFAULT_TIMEOUT_MS} ms，已终止后台任务`))),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    options.signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ ok: true; analysis: MapAnalysis } | { ok: false; error: string }>) => {
      const message = event.data;
      if (message.ok === true) { const analysis = message.analysis; finish(() => resolve({ analysis, execution: 'worker' })); }
      else { const error = message.error; finish(() => reject(new Error(error))); }
    };
    worker.onerror = () => finish(() => reject(new Error('MAP 后台分析器运行失败')));
    worker.postMessage({ source });
  });
}
