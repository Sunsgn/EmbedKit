/// <reference lib="webworker" />
import { analyzeMap } from '../utils/mapAnalyzer';

self.onmessage = (event: MessageEvent<{ source?: unknown }>) => {
  try {
    if (typeof event.data?.source !== 'string') throw new Error('MAP 后台分析请求无效');
    self.postMessage({ ok: true, analysis: analyzeMap(event.data.source) });
  } catch (reason) {
    self.postMessage({ ok: false, error: reason instanceof Error ? reason.message : String(reason) });
  }
};
