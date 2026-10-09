export type TraceEventType = 'boot' | 'enter' | 'exit' | 'task' | 'interrupt' | 'state' | 'queue' | 'error' | 'event';
export interface RuntimeTraceEvent { id: string; timestamp: number; type: TraceEventType; name: string; context?: string; value?: string; durationUs?: number; raw: string; line: number }
export interface RuntimeTraceAnalysis { events: RuntimeTraceEvent[]; executedNames: Set<string>; contexts: string[]; durationMs: number; warnings: string[] }

const eventTypes = new Set<TraceEventType>(['boot', 'enter', 'exit', 'task', 'interrupt', 'state', 'queue', 'error', 'event']);
const normalizeType = (value: string): TraceEventType => { const key = value.toLowerCase().replace(/[_-](?:enter|start)$/, ''); if (/task/.test(key)) return 'task'; if (/isr|irq|interrupt/.test(key)) return 'interrupt'; if (/state/.test(key)) return 'state'; if (/queue|mq/.test(key)) return 'queue'; if (/error|fault|assert/.test(key)) return 'error'; if (eventTypes.has(key as TraceEventType)) return key as TraceEventType; return 'event'; };
const timeValue = (value: unknown, fallback: number) => { if (typeof value === 'number') return value; const parsed = Number.parseFloat(String(value ?? '')); return Number.isFinite(parsed) ? parsed : fallback; };

export function parseRuntimeTrace(content: string): RuntimeTraceAnalysis {
  const events: RuntimeTraceEvent[] = [], warnings: string[] = [];
  for (const [index, raw] of content.split(/\r?\n/).entries()) {
    const line = raw.trim(); if (!line) continue;
    let data: { timestamp?: unknown; time?: unknown; type?: unknown; name?: unknown; context?: unknown; value?: unknown; durationUs?: unknown } | undefined;
    if (line.startsWith('{')) { try { data = JSON.parse(line); } catch { /* fall through to text parsing */ } }
    if (data) {
      const name = String(data.name ?? data.value ?? 'unknown'), type = normalizeType(String(data.type ?? 'event'));
      events.push({ id: `trace:${index}`, timestamp: timeValue(data.timestamp ?? data.time, index), type, name, context: data.context ? String(data.context) : undefined, value: data.value ? String(data.value) : undefined, durationUs: data.durationUs === undefined ? undefined : timeValue(data.durationUs, 0), raw, line: index + 1 }); continue;
    }
    const ek = line.match(/(?:^|\s)EK\|([\d.]+)\|([\w-]+)\|([^|\s]+)(?:\|([^|]*))?(?:\|([^|]*))?/i);
    const bracket = line.match(/^\[([\d:.]+)]\s*(?:\[([^\]]+)])?\s*(BOOT|ENTER|EXIT|TASK|ISR|IRQ|INTERRUPT|STATE|QUEUE|ERROR|EVENT)[:\s]+([^\s,;]+)/i);
    if (ek) events.push({ id: `trace:${index}`, timestamp: timeValue(ek[1], index), type: normalizeType(ek[2]), name: ek[3], context: ek[4] || undefined, value: ek[5] || undefined, raw, line: index + 1 });
    else if (bracket) { const clock = bracket[1].split(':').map(Number); const timestamp = clock.length === 3 ? ((clock[0] * 60 + clock[1]) * 60 + clock[2]) * 1000 : timeValue(bracket[1], index); events.push({ id: `trace:${index}`, timestamp, type: normalizeType(bracket[3]), name: bracket[4], context: bracket[2], raw, line: index + 1 }); }
  }
  events.sort((a, b) => a.timestamp - b.timestamp);
  if (!events.length && content.trim()) warnings.push('没有识别到轨迹事件；支持JSON Lines、EK管道格式和带时间戳的文本事件。');
  const executedNames = new Set(events.map(item => item.name)), contexts = [...new Set(events.map(item => item.context).filter((item): item is string => Boolean(item)))], durationMs = events.length > 1 ? events.at(-1)!.timestamp - events[0].timestamp : 0;
  return { events, executedNames, contexts, durationMs, warnings };
}

export function staticCoverage(staticNames: string[], trace: RuntimeTraceAnalysis) {
  const unique = [...new Set(staticNames)], executed = unique.filter(name => trace.executedNames.has(name)), missing = unique.filter(name => !trace.executedNames.has(name)), extra = [...trace.executedNames].filter(name => !unique.includes(name));
  return { total: unique.length, executed, missing, extra, rate: unique.length ? executed.length / unique.length : 0 };
}
