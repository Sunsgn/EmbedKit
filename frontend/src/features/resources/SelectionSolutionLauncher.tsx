import { useMemo, useState } from 'react';
import { FileSearch, FolderOpen, LayoutTemplate, ListChecks, Play, RotateCcw } from 'lucide-react';
import type { FunctionSolution, PartRole } from '../../types';
import { createFunctionSolution, listFunctionSolutions } from './functionSolutions';
import { parseRecommendationText } from './recommendationImport';
import { createRequirementSelection } from './requirementSelection';
import { discoverLocalParts, functionTemplates, getRoleCatalog } from './selectionRegistry';
import type { SelectionWorkspaceDraft } from './selectionWorkspaceDraft';

export interface SelectionLaunchResult {
  solution: FunctionSolution;
  intakeKind: 'requirement' | 'recommendation' | 'models' | 'template';
  intakeText: string;
  targetRoleId?: string;
}

type SecondaryView = 'none' | 'template' | 'history';

function suggestedTemplate(text: string) {
  if (/传感|采集|ADC|温度|压力|电流|模拟量/i.test(text)) return functionTemplates.find(item => item.id === 'sensor-acquisition-node') ?? functionTemplates[1];
  if (/CAN|RS-?485|RS-?422|Modbus|工业|现场总线|通信节点/i.test(text)) return functionTemplates.find(item => item.id === 'industrial-communication-node') ?? functionTemplates[0];
  return functionTemplates.find(item => item.id === 'blank') ?? functionTemplates[2];
}

function createCandidateInbox(): { solution: FunctionSolution; role: PartRole } {
  const solution = createFunctionSolution(functionTemplates.find(item => item.id === 'blank') ?? functionTemplates[2]);
  const role: PartRole = { id: crypto.randomUUID(), categoryId: 'custom', name: '待确认器件角色', purpose: '核验导入的候选型号；确认用途后可修改角色类别', constraints: [], candidatePartIds: [] };
  solution.name = '候选器件核验';
  solution.description = '由粘贴的候选型号创建；型号和参数必须经过来源核验。';
  solution.roles = [role];
  return { solution, role };
}

export default function SelectionSolutionLauncher({ draft, onStart, onDiscardDraft }: { draft: SelectionWorkspaceDraft | null; onStart: (result: SelectionLaunchResult) => void; onDiscardDraft: () => void }) {
  const [text, setText] = useState('');
  const [view, setView] = useState<SecondaryView>('none');
  const [templateId, setTemplateId] = useState(functionTemplates[0].id);
  const parsed = useMemo(() => parseRecommendationText(text), [text]);
  const recommendationLike = parsed.candidates.length > 0;
  const suggested = useMemo(() => suggestedTemplate(text), [text]);
  const suggestedCandidateCount = useMemo(() => text.trim() ? (suggested.roles.length ? suggested.roles.reduce((sum, role) => sum + getRoleCatalog(role.categoryId).length, 0) : discoverLocalParts(text).length) : 0, [suggested, text]);
  const records = useMemo(() => listFunctionSolutions().slice(0, 8), []);

  const startCandidates = () => {
    const { solution, role } = createCandidateInbox();
    onStart({ solution, intakeKind: 'recommendation', intakeText: text, targetRoleId: role.id });
  };
  const startRequirement = () => {
    const prepared = createRequirementSelection(suggested, text);
    onStart({ solution: prepared.solution, intakeKind: 'requirement', intakeText: text, targetRoleId: prepared.targetRoleId });
  };
  const startTemplate = () => {
    const template = functionTemplates.find(item => item.id === templateId) ?? functionTemplates[0];
    const solution = createFunctionSolution(template);
    onStart({ solution, intakeKind: 'template', intakeText: '', targetRoleId: solution.roles[0]?.id });
  };

  return <section className="space-y-4">
    <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5">
      <h2 className="text-base font-semibold text-gray-100">方案选型与验证</h2>
      <p className="mt-1 text-xs leading-5 text-gray-500">粘贴产品需求、AI 回复或型号列表。系统只提取可确定的信息，无法确认的内容保留为待核验项。</p>
      <textarea aria-label="需求或候选内容" value={text} onChange={event => { setText(event.target.value); setView('none'); }} maxLength={64 * 1024} rows={7} placeholder="例如：需要支持 CAN FD、-40～85°C 的控制器；或直接粘贴 STM32G474RET6、S32K144……" className="mt-4 w-full resize-y rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-sm leading-6 outline-none focus:border-blue-500" />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-600"><span>本地解析 · 最多 64 KiB</span>{recommendationLike ? <span className="text-purple-300">识别到 {parsed.candidates.length} 个可能型号</span> : text.trim() ? <span>建议结构：{suggested.name} · {suggestedCandidateCount ? `预计加载 ${suggestedCandidateCount} 个本地候选` : '本地目录暂无匹配候选'}</span> : null}</div>
      {recommendationLike && <div className="mt-3 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3"><div className="flex items-center gap-2 text-xs text-purple-300"><ListChecks size={14} />候选预览</div><div className="mt-2 flex flex-wrap gap-1">{parsed.candidates.slice(0, 12).map(item => <span key={item.id} className="rounded bg-[#0d1117] px-2 py-1 text-[10px] text-gray-300">{item.model}</span>)}</div><p className="mt-2 text-[10px] text-gray-500">推荐文字不作为参数证据；下一步查询精确型号并选择真实器件类别。</p></div>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">{recommendationLike && <button onClick={startRequirement} className="rounded border border-[#30363d] px-3 py-2 text-xs text-gray-400">按完整需求建方案</button>}<button onClick={recommendationLike ? startCandidates : startRequirement} disabled={!text.trim()} className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-xs text-white disabled:opacity-40"><Play size={13} />{recommendationLike ? `核验 ${parsed.candidates.length} 个候选型号` : '按需求开始'}</button></div>
    </div>

    {draft && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4"><RotateCcw size={18} className="text-blue-400" /><div className="min-w-0 flex-1"><b className="block truncate text-sm text-gray-200">未完成：{draft.solution.name}</b><small className="text-[10px] text-gray-500">{new Date(draft.updatedAt).toLocaleString()} · {draft.solution.roles.length} 个角色 · {draft.solution.parts.length} 个候选</small></div><button onClick={() => onStart(draft)} className="rounded bg-blue-600 px-3 py-2 text-xs text-white">继续</button><button onClick={onDiscardDraft} className="rounded border border-[#30363d] px-3 py-2 text-xs text-gray-400">放弃</button></div>}

    <div className="grid gap-2 sm:grid-cols-2">
      <button onClick={() => setView(current => current === 'template' ? 'none' : 'template')} className="flex items-center gap-3 rounded-xl border border-[#30363d] bg-[#161b22] p-3 text-left hover:border-[#484f58]"><LayoutTemplate size={17} className="text-gray-500" /><span><b className="block text-xs text-gray-200">从模板或空白方案开始</b><small className="text-[10px] text-gray-600">需要手动控制系统结构时使用</small></span></button>
      <button onClick={() => setView(current => current === 'history' ? 'none' : 'history')} className="flex items-center gap-3 rounded-xl border border-[#30363d] bg-[#161b22] p-3 text-left hover:border-[#484f58]"><FolderOpen size={17} className="text-gray-500" /><span><b className="block text-xs text-gray-200">打开历史方案</b><small className="text-[10px] text-gray-600">继续已有条件、候选和证据</small></span></button>
    </div>

    {view === 'template' && <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[#30363d] bg-[#161b22] p-4"><label className="min-w-[260px] flex-1"><span className="mb-2 block text-xs text-gray-300">方案结构</span><select aria-label="方案模板" value={templateId} onChange={event => setTemplateId(event.target.value)} className="field">{functionTemplates.map(item => <option key={item.id} value={item.id}>{item.name} — {item.description}</option>)}</select></label><button onClick={startTemplate} className="rounded bg-blue-600 px-4 py-2 text-xs text-white">进入工作区</button></div>}
    {view === 'history' && <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-4">{records.length === 0 ? <p className="py-6 text-center text-xs text-gray-600">尚无保存记录</p> : <div className="grid gap-2 sm:grid-cols-2">{records.map(record => <button key={record.id} onClick={() => onStart({ solution: record, intakeKind: 'template', intakeText: '', targetRoleId: record.roles[0]?.id })} className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-left hover:border-blue-500/40"><b className="block truncate text-xs text-gray-200">{record.name}</b><small className="mt-1 block text-[10px] text-gray-600">{record.roles.length} 个角色 · {record.parts.length} 个候选</small></button>)}</div>}</div>}
    {!text.trim() && view === 'none' && <div className="flex items-center justify-center gap-2 py-2 text-[10px] text-gray-600"><FileSearch size={13} />无需先选择流程，直接粘贴内容即可</div>}
  </section>;
}
