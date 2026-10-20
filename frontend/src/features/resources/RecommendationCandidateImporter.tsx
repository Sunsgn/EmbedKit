import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardPaste, Loader2, SearchCheck, Square } from 'lucide-react';
import type { PartRecord } from '../../types';
import { AgentClientError } from '../../services/agentClient';
import { lookupOnlinePart, onlineDetailsToPart } from '../../services/partSources';
import { attachRecommendationEvidence, isExactRecommendationMatch, parseRecommendationText, type RecommendationCandidate } from './recommendationImport';

const VERIFY_LIMIT = 12;
type VerificationState = {
  state: 'pending' | 'querying' | 'added' | 'mismatch' | 'error' | 'cancelled';
  message: string;
};

export default function RecommendationCandidateImporter({ onAdd, initialText = '' }: { onAdd: (parts: PartRecord[]) => void; initialText?: string }) {
  const initial = parseRecommendationText(initialText);
  const initialHighConfidence = initial.candidates.filter((item) => item.confidence === 'high').slice(0, VERIFY_LIMIT);
  const [open, setOpen] = useState(Boolean(initialText)),
    [text, setText] = useState(initialText),
    [candidates, setCandidates] = useState<RecommendationCandidate[]>(initial.candidates);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialHighConfidence.map((item) => item.id))),
    [results, setResults] = useState<Record<string, VerificationState>>({}),
    [warnings, setWarnings] = useState<string[]>(initial.warnings),
    [running, setRunning] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const parse = () => {
    const parsed = parseRecommendationText(text),
      highConfidence = parsed.candidates.filter((item) => item.confidence === 'high');
    setCandidates(parsed.candidates);
    setWarnings([...parsed.warnings, ...(highConfidence.length > VERIFY_LIMIT ? [`高置信度候选超过 ${VERIFY_LIMIT} 个，本批只预选前 ${VERIFY_LIMIT} 个`] : [])]);
    setSelected(new Set(highConfidence.slice(0, VERIFY_LIMIT).map((item) => item.id)));
    setResults({});
  };
  const verify = async () => {
    const queue = candidates.filter((candidate) => selected.has(candidate.id)).slice(0, VERIFY_LIMIT);
    if (!queue.length) return;
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    const imported: PartRecord[] = [],
      importId = crypto.randomUUID();
    for (const candidate of queue) {
      if (abort.signal.aborted) break;
      setResults((current) => ({
        ...current,
        [candidate.id]: { state: 'querying', message: '正在查询精确型号' },
      }));
      try {
        const details = await lookupOnlinePart(candidate.model, abort.signal);
        if (!isExactRecommendationMatch(candidate.model, details.productName)) {
          setResults((current) => ({
            ...current,
            [candidate.id]: {
              state: 'mismatch',
              message: `来源返回“${details.productName}”，不是精确型号，未导入`,
            },
          }));
          continue;
        }
        const part = attachRecommendationEvidence(onlineDetailsToPart(details), candidate, importId);
        imported.push(part);
        setResults((current) => ({
          ...current,
          [candidate.id]: {
            state: 'added',
            message: `来源返回精确型号，已导入 ${part.parameters.length} 个待核验字段`,
          },
        }));
      } catch (reason) {
        if (reason instanceof AgentClientError && reason.kind === 'cancelled') {
          setResults((current) => ({
            ...current,
            [candidate.id]: { state: 'cancelled', message: '已取消' },
          }));
          break;
        }
        setResults((current) => ({
          ...current,
          [candidate.id]: {
            state: 'error',
            message: reason instanceof Error ? reason.message : '查询失败',
          },
        }));
      }
    }
    if (imported.length) onAdd(imported);
    setRunning(false);
    controller.current = null;
  };
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < VERIFY_LIMIT) next.add(id);
      else setWarnings((value) => [...new Set([...value, `单批最多选择 ${VERIFY_LIMIT} 个型号，请取消其他候选后再选择`])]);
      return next;
    });

  return (
    <div className="rounded-lg border border-purple-500/20 bg-purple-500/[0.04]">
      <button onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-3 p-3 text-left">
        <ClipboardPaste size={16} className="text-purple-400" />
        <span className="min-w-0 flex-1">
          <b className="block text-xs text-gray-200">导入 AI 或外部推荐</b>
          <small className="text-[10px] text-gray-600">粘贴回复、Markdown 表格或型号列表，重新核验候选和硬条件</small>
        </span>
        <span className="text-[10px] text-purple-300">{open ? '收起' : '展开'}</span>
      </button>
      {open && (
        <div className="border-t border-[#30363d] p-3">
          <textarea aria-label="推荐文本" value={text} onChange={(event) => setText(event.target.value)} maxLength={64 * 1024} rows={6} placeholder="粘贴 AI 推荐回复或型号列表。内容仅在本机解析，查询时只向 Local Agent 发送勾选的完整型号。" className="w-full resize-y rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-xs leading-5 outline-none focus:border-purple-500" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] text-gray-600">
              {text.length}/65536 字符 · 单批最多核验 {VERIFY_LIMIT} 个型号
            </span>
            <button onClick={parse} disabled={!text.trim() || running} className="flex items-center gap-1 rounded border border-purple-500/30 px-3 py-1.5 text-xs text-purple-300 disabled:opacity-40">
              <SearchCheck size={13} />
              提取候选
            </button>
          </div>
          {warnings.map((warning) => (
            <p key={warning} className="mt-2 text-[10px] text-yellow-400">
              {warning}
            </p>
          ))}
          {candidates.length > 0 && (
            <div className="mt-3 space-y-1">
              <div className="mb-2 flex items-center justify-between text-[10px] text-gray-600">
                <span>
                  识别 {candidates.length} 个候选，已选 {selected.size}
                </span>
                <span>低置信度候选默认不勾选</span>
              </div>
              {candidates.map((candidate) => {
                const result = results[candidate.id];
                return (
                  <label key={candidate.id} className="flex items-start gap-2 rounded border border-[#30363d] bg-[#0d1117] p-2.5">
                    <input type="checkbox" checked={selected.has(candidate.id)} onChange={() => toggle(candidate.id)} disabled={running} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <b className="text-xs text-gray-200">{candidate.model}</b>
                        <small className={candidate.confidence === 'high' ? 'text-green-400' : 'text-yellow-400'}>{candidate.confidence === 'high' ? '高置信度' : '需确认'}</small>
                      </span>
                      <small className="mt-0.5 block truncate text-[9px] text-gray-600">
                        第 {candidate.lineNumber} 行：{candidate.excerpt}
                      </small>
                      {result && (
                        <small className={`mt-1 flex items-center gap-1 text-[10px] ${result.state === 'added' ? 'text-green-400' : result.state === 'querying' ? 'text-blue-400' : result.state === 'pending' ? 'text-gray-500' : 'text-yellow-400'}`}>
                          {result.state === 'querying' ? <Loader2 size={10} className="animate-spin" /> : result.state === 'added' ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                          {result.message}
                        </small>
                      )}
                    </span>
                  </label>
                );
              })}
              <div className="mt-3 flex justify-end">
                {running ? (
                  <button onClick={() => controller.current?.abort()} className="flex items-center gap-1 rounded border border-red-500/30 px-3 py-1.5 text-xs text-red-300">
                    <Square size={11} />
                    停止查询
                  </button>
                ) : (
                  <button onClick={() => void verify()} disabled={!selected.size} className="rounded bg-purple-600 px-3 py-1.5 text-xs text-white disabled:opacity-40">
                    查询并加入当前角色
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
