import { useMemo, useState } from 'react';
import { Download, FileUp, Plus, Save, Search, Trash2 } from 'lucide-react';
import { createKnowledgeExperienceLibrary, KNOWLEDGE_EXPERIENCE_IMPORT_MAX_BYTES, parseKnowledgeExperienceLibrary, readKnowledgeExperiences, saveKnowledgeExperiences, searchKnowledgeExperiences, upsertKnowledgeExperience, type KnowledgeExperienceRecord, type KnowledgeExperienceStatus } from '../../services/knowledgeExperience';

type FormState = Omit<KnowledgeExperienceRecord, 'schemaVersion' | 'createdAt' | 'updatedAt'>;
const statusLabels: Record<KnowledgeExperienceStatus, string> = { draft: '草稿', verified: '已验证', invalidated: '已失效' };
const lines = (value: string) => value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
const text = (value: string[]) => value.join('\n');
const newId = () => globalThis.crypto?.randomUUID?.() ?? `experience-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const emptyForm = (): FormState => ({ id: newId(), title: '', symptom: '', context: '', applicability: '', possibleCauses: [], diagnosticSteps: [], resolutionSteps: [], rollbackSteps: [], retestSteps: [], evidenceReferences: [], status: 'draft' });
const fromRecord = (record: KnowledgeExperienceRecord): FormState => ({ id: record.id, title: record.title, symptom: record.symptom, context: record.context, applicability: record.applicability, possibleCauses: record.possibleCauses, diagnosticSteps: record.diagnosticSteps, resolutionSteps: record.resolutionSteps, rollbackSteps: record.rollbackSteps, retestSteps: record.retestSteps, evidenceReferences: record.evidenceReferences, status: record.status, ...(record.replacementId ? { replacementId: record.replacementId } : {}) });

export default function KnowledgeExperienceWorkspace() {
  const [records, setRecords] = useState(() => readKnowledgeExperiences());
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [query, setQuery] = useState(''), [status, setStatus] = useState('');
  const [notice, setNotice] = useState(''), [error, setError] = useState('');
  const filtered = useMemo(() => searchKnowledgeExperiences(records, query, status), [query, records, status]);
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(current => ({ ...current, [key]: value }));
  const save = () => {
    setError(''); setNotice('');
    try { const next = upsertKnowledgeExperience(form, records); setRecords(saveKnowledgeExperiences(next)); setNotice(form.status === 'verified' ? '已保存为可核验经验' : '经验记录已保存'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const remove = () => {
    if (!records.some(record => record.id === form.id) || !confirm(`确认删除“${form.title}”？请先导出需要保留的记录。`)) return;
    const next = records.filter(record => record.id !== form.id); setRecords(saveKnowledgeExperiences(next)); setForm(emptyForm()); setNotice('记录已从本地经验库删除'); setError('');
  };
  const download = () => {
    const content = JSON.stringify(createKnowledgeExperienceLibrary(records), null, 2), url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `embedkit-knowledge-experiences-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url); setNotice('经验库 JSON 已导出');
  };
  const importFile = async (file?: File) => {
    setError(''); setNotice('');
    if (!file) return;
    if (file.size > KNOWLEDGE_EXPERIENCE_IMPORT_MAX_BYTES) { setError('经验库文件超过 2 MiB 上限'); return; }
    try {
      const incoming = parseKnowledgeExperienceLibrary(await file.text()).records, existingIds = new Set(records.map(record => record.id)), conflicts = incoming.filter(record => existingIds.has(record.id));
      if (conflicts.length) throw new Error(`导入包含 ${conflicts.length} 个同 ID 记录；为避免覆盖，请先处理冲突或使用工作区备份合并`);
      const next = saveKnowledgeExperiences([...incoming, ...records]); setRecords(next); setNotice(`已导入 ${incoming.length} 条经验记录`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  return <div className="theme-canvas grid min-h-[620px] lg:grid-cols-[340px_minmax(0,1fr)]">
    <aside className="border-b border-[#30363d] p-4 lg:border-b-0 lg:border-r">
      <div className="flex gap-2"><label className="relative min-w-0 flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" /><input aria-label="搜索工程经验" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索症状、范围、原因或证据…" className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] py-2 pl-9 pr-3 text-xs outline-none focus:border-purple-500" /></label><button type="button" onClick={() => { setForm(emptyForm()); setError(''); setNotice(''); }} className="rounded-lg border border-purple-500/30 px-2.5 text-purple-300" aria-label="新建工程经验"><Plus size={15} /></button></div>
      <select aria-label="经验状态" value={status} onChange={event => setStatus(event.target.value)} className="mt-2 w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs"><option value="">全部状态</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <div className="mt-3 max-h-[430px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">{filtered.map(record => <button key={record.id} type="button" onClick={() => { setForm(fromRecord(record)); setError(''); setNotice(''); }} className={`w-full rounded-lg border p-3 text-left ${form.id === record.id ? 'border-purple-500/40 bg-purple-500/10' : 'border-[#30363d] bg-[#0d1117] hover:border-[#484f58]'}`}><div className="flex items-start justify-between gap-2"><b className="text-xs text-gray-200">{record.title}</b><span className="shrink-0 text-[9px] text-purple-300">{statusLabels[record.status]}</span></div><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-gray-600">{record.symptom}</p><p className="mt-1 truncate text-[9px] text-gray-700">{record.applicability || '适用范围待补充'}</p></button>)}{!filtered.length && <p className="rounded-lg border border-dashed border-[#30363d] py-8 text-center text-xs text-gray-600">没有匹配记录</p>}</div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-[#30363d] pt-3"><label className="flex cursor-pointer items-center gap-1 rounded border border-[#30363d] px-2 py-1.5 text-[10px] text-gray-400"><FileUp size={11} />导入 JSON<input type="file" accept="application/json,.json" aria-label="导入工程经验 JSON" className="hidden" onChange={event => { void importFile(event.target.files?.[0]); event.target.value = ''; }} /></label><button type="button" onClick={download} className="flex items-center gap-1 rounded border border-[#30363d] px-2 py-1.5 text-[10px] text-gray-400"><Download size={11} />导出 {records.length} 条</button></div>
    </aside>
    <article className="theme-canvas min-w-0 p-4 lg:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold text-gray-100">{records.some(record => record.id === form.id) ? '编辑工程经验' : '记录真实问题经验'}</h3><p className="mt-1 text-[10px] text-gray-600">仅保存在当前浏览器；“已验证”必须同时具备证据引用与复测步骤。</p></div><div className="flex gap-2"><button type="button" onClick={save} className="flex items-center gap-1 rounded bg-purple-600 px-3 py-2 text-xs text-white"><Save size={12} />保存</button>{records.some(record => record.id === form.id) && <button type="button" onClick={remove} className="flex items-center gap-1 rounded border border-red-500/30 px-3 py-2 text-xs text-red-300"><Trash2 size={12} />删除</button>}</div></div>
      <div className="mt-5 grid gap-3 md:grid-cols-2"><Field label="标题 *" value={form.title} onChange={value => setField('title', value)} /><label className="text-xs text-gray-500">状态<select aria-label="记录状态" value={form.status} onChange={event => setField('status', event.target.value as KnowledgeExperienceStatus)} className="mt-1 w-full rounded border border-[#30363d] bg-[#111820] px-3 py-2 text-gray-200">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <div className="mt-3 grid gap-3 md:grid-cols-2"><Area label="症状 *" value={form.symptom} onChange={value => setField('symptom', value)} /><Area label="上下文" value={form.context} onChange={value => setField('context', value)} /><Area label="适用范围" value={form.applicability} onChange={value => setField('applicability', value)} /><ListArea label="可能原因（每行一项）" value={form.possibleCauses} onChange={value => setField('possibleCauses', value)} /><ListArea label="诊断步骤（每行一项）" value={form.diagnosticSteps} onChange={value => setField('diagnosticSteps', value)} /><ListArea label="解决步骤（每行一项）" value={form.resolutionSteps} onChange={value => setField('resolutionSteps', value)} /><ListArea label="回退步骤（每行一项）" value={form.rollbackSteps} onChange={value => setField('rollbackSteps', value)} /><ListArea label="复测步骤（已验证必填）" value={form.retestSteps} onChange={value => setField('retestSteps', value)} /><ListArea label="证据引用（已验证必填）" value={form.evidenceReferences} onChange={value => setField('evidenceReferences', value)} />{form.status === 'invalidated' && <Field label="替代记录 ID *" value={form.replacementId ?? ''} onChange={value => setField('replacementId', value)} />}</div>
      {error && <p role="alert" className="mt-4 rounded border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">{error}</p>}{notice && <p role="status" className="mt-4 rounded border border-green-500/30 bg-green-500/5 p-3 text-xs text-green-300">{notice}</p>}
      <p className="mt-4 text-[10px] leading-4 text-gray-700">资源边界：最多 200 条、单文件 2 MiB、每个列表 40 项。导入遇到同 ID 时拒绝覆盖；项目私有内容不会自动上传到网络或 AI 服务。</p>
    </article>
  </div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-xs text-gray-500">{label}<input value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded border border-[#30363d] bg-[#111820] px-3 py-2 text-gray-200 outline-none focus:border-purple-500" /></label>; }
function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-xs text-gray-500">{label}<textarea value={value} onChange={event => onChange(event.target.value)} className="mt-1 min-h-20 w-full resize-y rounded border border-[#30363d] bg-[#111820] px-3 py-2 text-gray-200 outline-none focus:border-purple-500" /></label>; }
function ListArea({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) { return <Area label={label} value={text(value)} onChange={value => onChange(lines(value))} />; }
