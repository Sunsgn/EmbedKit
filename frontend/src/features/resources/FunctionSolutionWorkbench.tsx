import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Download, FileCheck2, Filter, Layers3, Plus, Save, ShieldQuestion, XCircle } from 'lucide-react';
import type { FunctionSolution, PartRole } from '../../types';
import DynamicConstraintEditor from './DynamicConstraintEditor';
import { createFunctionSolution, saveFunctionSolution } from './functionSolutions';
import { rankDynamicPartSelections } from './selectionEngine';
import { functionTemplates, getParameterDefinitions, getRoleCatalog } from './selectionRegistry';
import OnlinePartLookup from './OnlinePartLookup';

const statusStyle = {
  eligible: ['满足必须条件', 'text-green-300 bg-green-500/10'],
  'needs-verification': ['需要核验', 'text-yellow-300 bg-yellow-500/10'],
  excluded: ['已排除', 'text-red-300 bg-red-500/10'],
} as const;

const categoryNames: Record<string, string> = {
  mcu: 'MCU / 微控制器', 'communication-transceiver': '通信收发器', sensor: '传感器 / 输入接口', adc: 'ADC', power: '电源', isolation: '数字隔离', protection: '接口保护', storage: '存储器', 'signal-conditioning': '信号调理', custom: '自定义角色',
};

function downloadSolution(solution: FunctionSolution) {
  const blob = new Blob([JSON.stringify(solution, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = `${solution.name.replace(/[^\w\u4e00-\u9fa5-]+/g, '-') || 'selection-solution'}.json`; anchor.click(); URL.revokeObjectURL(url);
}

export default function FunctionSolutionWorkbench({ initialSolution }: { initialSolution?: FunctionSolution }) {
  const [solution, setSolution] = useState<FunctionSolution>(() => initialSolution ?? createFunctionSolution(functionTemplates[0]));
  const [roleId, setRoleId] = useState(solution.roles[0]?.id ?? '');
  const [tab, setTab] = useState<'constraints' | 'candidates' | 'evidence'>('constraints');
  const [message, setMessage] = useState('');
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleCategory, setNewRoleCategory] = useState('mcu');
  const [newRoleName, setNewRoleName] = useState('');
  const role = solution.roles.find(item => item.id === roleId) ?? solution.roles[0];
  const definitions = useMemo(() => role ? getParameterDefinitions(role.categoryId) : [], [role]);
  const candidates = useMemo(() => role ? solution.parts.filter(part => role.candidatePartIds.includes(part.id)) : [], [role, solution.parts]);
  const evaluations = useMemo(() => role ? rankDynamicPartSelections(candidates, role.constraints, definitions) : [], [candidates, definitions, role]);
  const updateRole = (next: PartRole) => setSolution(current => ({ ...current, roles: current.roles.map(item => item.id === next.id ? next : item) }));
  const applyTemplate = (templateId: string) => {
    if (!window.confirm('创建新方案会替换当前未保存的工作区，是否继续？')) return;
    const next = createFunctionSolution(functionTemplates.find(item => item.id === templateId) ?? functionTemplates[2]);
    setSolution(next); setRoleId(next.roles[0]?.id ?? ''); setTab('constraints'); setMessage('已创建新方案，尚未保存');
  };
  const addRole = () => {
    const name = newRoleName.trim() || categoryNames[newRoleCategory] || newRoleCategory;
    const next: PartRole = { id: crypto.randomUUID(), categoryId: newRoleCategory, name, purpose: '', constraints: [], candidatePartIds: [] };
    setSolution(current => ({ ...current, roles: [...current.roles, next] })); setRoleId(next.id); setNewRoleName(''); setShowAddRole(false);
  };
  const removeRole = (target: PartRole) => {
    if (!window.confirm(`删除角色“${target.name}”？候选器件仍保留在方案资料中。`)) return;
    const nextRoles = solution.roles.filter(item => item.id !== target.id);
    setSolution(current => ({ ...current, roles: nextRoles })); setRoleId(nextRoles[0]?.id ?? '');
  };
  const loadCatalog = () => {
    if (!role) return;
    const catalog = getRoleCatalog(role.categoryId);
    if (!catalog.length) { setMessage('此角色尚无目录适配器，请添加自定义条件并通过型号查询导入候选'); return; }
    setSolution(current => ({ ...current, parts: [...current.parts.filter(part => !catalog.some(item => item.id === part.id)), ...catalog], roles: current.roles.map(item => item.id === role.id ? { ...item, candidatePartIds: [...new Set([...item.candidatePartIds, ...catalog.map(part => part.id)])] } : item) }));
    setMessage(`已加载 ${catalog.length} 个本地候选，导入参数仍需官方资料核验`); setTab('candidates');
  };
  const save = () => { try { const saved = saveFunctionSolution(solution); setSolution(saved); setMessage('功能方案已保存到本机'); } catch (reason) { setMessage(reason instanceof Error ? reason.message : '保存失败'); } };
  const evidenceStatuses = solution.parts.flatMap(part => part.parameters).map(parameter => parameter.status);
  const verified = evidenceStatuses.filter(status => status === 'verified').length, evidenceTotal = evidenceStatuses.length;

  return <section className="overflow-hidden rounded-xl border border-[#30363d] bg-[#161b22]">
    <header className="border-b border-[#30363d] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-[240px] flex-1"><div className="flex items-center gap-2 text-sm font-semibold text-blue-300"><Layers3 size={16} />功能方案工作台</div><input aria-label="方案名称" value={solution.name} onChange={event => setSolution(current => ({ ...current, name: event.target.value }))} className="mt-2 w-full max-w-xl bg-transparent text-lg font-semibold text-gray-100 outline-none" /><input aria-label="功能描述" value={solution.description} onChange={event => setSolution(current => ({ ...current, description: event.target.value }))} className="mt-1 w-full max-w-3xl bg-transparent text-xs text-gray-500 outline-none" /></div><div className="flex flex-wrap gap-2"><label className="relative"><select aria-label="新建方案模板" defaultValue="" onChange={event => { if (event.target.value) applyTemplate(event.target.value); event.target.value = ''; }} className="appearance-none rounded border border-[#30363d] bg-[#0d1117] py-2 pl-3 pr-8 text-xs text-gray-300"><option value="">新建方案…</option>{functionTemplates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={12} className="pointer-events-none absolute right-2 top-2.5 text-gray-500" /></label><button onClick={save} className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-2 text-xs text-white"><Save size={13} />保存</button><button onClick={() => downloadSolution(solution)} className="flex items-center gap-1.5 rounded border border-[#30363d] px-3 py-2 text-xs text-gray-300"><Download size={13} />导出</button></div></div>{message && <p role="status" className="mt-3 text-[11px] text-blue-300">{message}</p>}</header>

    <div className="grid min-h-[560px] xl:grid-cols-[240px_minmax(0,1fr)_300px]">
      <aside className="border-b border-[#30363d] p-3 xl:border-b-0 xl:border-r"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">器件角色 · {solution.roles.length}</span><button aria-label="添加角色" onClick={() => setShowAddRole(value => !value)} className="text-blue-400"><Plus size={15} /></button></div>{showAddRole && <div className="mb-3 space-y-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-2"><select aria-label="角色类别" value={newRoleCategory} onChange={event => setNewRoleCategory(event.target.value)} className="field">{Object.entries(categoryNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><input aria-label="角色名称" value={newRoleName} onChange={event => setNewRoleName(event.target.value)} placeholder="名称（可选）" className="field" /><button onClick={addRole} className="w-full rounded bg-blue-600 py-1.5 text-xs text-white">添加到方案</button></div>}<div className="flex gap-2 overflow-x-auto pb-1 xl:block xl:space-y-1">{solution.roles.map(item => <div key={item.id} className={`group flex min-w-[170px] items-center rounded-lg border ${role?.id === item.id ? 'border-blue-500/40 bg-blue-500/10' : 'border-transparent hover:bg-white/5'}`}><button onClick={() => { setRoleId(item.id); setTab('constraints'); }} className="min-w-0 flex-1 p-2.5 text-left"><b className="block truncate text-xs text-gray-200">{item.name}</b><small className="text-[10px] text-gray-600">{categoryNames[item.categoryId] || item.categoryId} · {item.constraints.length} 条件</small></button><button aria-label={`删除角色 ${item.name}`} onClick={() => removeRole(item)} className="mr-2 hidden text-gray-600 hover:text-red-400 group-hover:block"><XCircle size={13} /></button></div>)}</div>{solution.roles.length === 0 && <div className="rounded-lg border border-dashed border-[#30363d] p-4 text-center text-xs text-gray-600">空白方案尚无角色<br />点击“+”添加</div>}</aside>

      <main className="min-w-0 p-4">{role ? <><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold text-gray-200">{role.name}</h2><p className="text-[10px] text-gray-600">{role.purpose || '尚未填写角色用途'} · 当前候选 {candidates.length}</p></div><button onClick={loadCatalog} className="rounded border border-blue-500/30 px-3 py-1.5 text-xs text-blue-300">加载本地候选</button></div><nav aria-label="角色工作区" className="mb-4 flex border-b border-[#30363d]">{([['constraints', '选型条件'], ['candidates', `候选器件 ${candidates.length}`], ['evidence', '资料核验']] as const).map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`border-b-2 px-4 py-2 text-xs ${tab === id ? 'border-blue-500 text-blue-300' : 'border-transparent text-gray-500'}`}>{label}</button>)}</nav>
        {tab === 'constraints' && <DynamicConstraintEditor categoryId={role.categoryId} constraints={role.constraints} availableParameters={[...new Map(candidates.flatMap(part => part.parameters).map(parameter => [parameter.key, parameter])).values()]} onChange={constraints => updateRole({ ...role, constraints })} />}
        {tab === 'candidates' && <div className="space-y-2"><OnlinePartLookup onAdd={part => { if (role.candidatePartIds.length >= 100 && !role.candidatePartIds.includes(part.id)) { setMessage('单个角色最多保留 100 个候选，请先移除不需要的候选'); return; } setSolution(current => ({ ...current, parts: [...current.parts.filter(item => item.id !== part.id), part], roles: current.roles.map(item => item.id === role.id ? { ...item, candidatePartIds: [...new Set([...item.candidatePartIds, part.id])] } : item) })); setMessage(`${part.mpn} 已加入当前角色；在线参数保持待核验状态`); }} />{evaluations.length === 0 ? <div className="rounded-lg border border-dashed border-[#30363d] py-12 text-center text-xs text-gray-600">没有候选。可加载本地目录，或按完整型号在线发现。</div> : evaluations.map(result => { const part = candidates.find(item => item.id === result.partId)!; return <article key={part.id} className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3"><div className="flex items-start justify-between gap-2"><div><b className="text-sm text-gray-200">{part.mpn}</b><p className="text-[10px] text-gray-600">{part.manufacturer} · {part.subcategory}</p></div><div className="flex items-center gap-2"><span className={`rounded px-2 py-1 text-[10px] ${statusStyle[result.outcome][1]}`}>{statusStyle[result.outcome][0]}</span><button aria-label={`移除候选 ${part.mpn}`} onClick={() => updateRole({ ...role, candidatePartIds: role.candidatePartIds.filter(id => id !== part.id), selectedPartId: role.selectedPartId === part.id ? undefined : role.selectedPartId })} className="text-gray-600 hover:text-red-400"><XCircle size={13} /></button></div></div><div className="mt-2 flex flex-wrap gap-1">{result.evaluations.map(item => <span key={item.criterionId} title={item.message} className={`rounded px-1.5 py-1 text-[9px] ${item.outcome === 'match' ? 'bg-green-500/10 text-green-300' : item.outcome === 'mismatch' ? 'bg-red-500/10 text-red-300' : 'bg-yellow-500/10 text-yellow-300'}`}>{item.label}：{item.outcome === 'match' ? '满足' : item.outcome === 'mismatch' ? '不满足' : '未知'}</span>)}</div></article>; })}</div>}
        {tab === 'evidence' && <div className="space-y-2">{candidates.length === 0 ? <p className="rounded-lg border border-dashed border-[#30363d] py-12 text-center text-xs text-gray-600">加载或导入候选后核验资料。</p> : candidates.map(part => <article key={part.id} className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3"><div className="flex items-center justify-between"><b className="text-xs text-gray-200">{part.mpn}</b><span className="text-[10px] text-gray-600">{part.parameters.length} 个参数 · {part.documents.length} 份资料</span></div><div className="mt-2 grid gap-1 sm:grid-cols-2">{part.parameters.slice(0, 12).map(parameter => <div key={parameter.key} className="rounded border border-[#20262e] px-2 py-1.5"><div className="flex justify-between gap-2 text-[9px] text-gray-600"><span>{parameter.label}</span><code>{parameter.key}</code></div><div className="mt-0.5 truncate text-[10px] text-gray-300">{parameter.value !== undefined ? (Array.isArray(parameter.value) ? parameter.value.join('、') : String(parameter.value)) : `${parameter.min ?? '?'}～${parameter.max ?? '?'}${parameter.unit ?? ''}`}</div></div>)}</div>{part.parameters.length > 12 && <p className="mt-1 text-[9px] text-gray-600">仅展示前 12 个字段；完整字段保留在导出记录中。</p>}<div className="mt-2 flex flex-wrap gap-2">{part.documents.map(document => document.url ? <a key={document.id} href={document.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400">{document.title}</a> : <span key={document.id} className="text-[10px] text-gray-600">{document.title}（无链接）</span>)}</div></article>)}</div>}
      </> : <div className="flex h-full items-center justify-center text-center text-sm text-gray-600">添加一个器件角色后开始设置条件。</div>}</main>

      <aside className="border-t border-[#30363d] p-4 xl:border-l xl:border-t-0"><h3 className="flex items-center gap-2 text-xs font-semibold text-gray-300"><FileCheck2 size={14} className="text-purple-400" />方案检查</h3><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg bg-[#0d1117] p-2.5"><div className="text-[10px] text-gray-600">角色</div><b className="text-sm">{solution.roles.length}</b></div><div className="rounded-lg bg-[#0d1117] p-2.5"><div className="text-[10px] text-gray-600">候选</div><b className="text-sm">{solution.roles.reduce((sum, item) => sum + item.candidatePartIds.length, 0)}</b></div><div className="rounded-lg bg-[#0d1117] p-2.5"><div className="text-[10px] text-gray-600">已验证参数</div><b className="text-sm text-green-300">{verified}/{evidenceTotal}</b></div><div className="rounded-lg bg-[#0d1117] p-2.5"><div className="text-[10px] text-gray-600">兼容性问题</div><b className="text-sm text-yellow-300">{solution.compatibilityResults.filter(item => item.outcome !== 'compatible').length}</b></div></div><div className="mt-4 space-y-2"><div className="flex gap-2 rounded-lg border border-yellow-500/15 bg-yellow-500/5 p-3"><ShieldQuestion size={15} className="shrink-0 text-yellow-400" /><p className="text-[10px] leading-4 text-gray-400">跨角色电压、接口、速率和温度规则将在下一增量接入；当前不会把“尚未检查”显示为兼容。</p></div>{solution.roles.some(item => item.constraints.length === 0) && <div className="flex gap-2 rounded-lg border border-yellow-500/15 p-3"><AlertTriangle size={14} className="shrink-0 text-yellow-400" /><p className="text-[10px] text-gray-400">存在未设置条件的角色。</p></div>}{role && evaluations.some(item => item.outcome === 'eligible') && <div className="flex gap-2 rounded-lg border border-green-500/15 p-3"><CheckCircle2 size={14} className="shrink-0 text-green-400" /><p className="text-[10px] text-gray-400">当前角色存在满足全部已验证必须条件的候选。</p></div>}{role && evaluations.some(item => item.outcome === 'excluded') && <div className="flex gap-2 rounded-lg border border-red-500/15 p-3"><Filter size={14} className="shrink-0 text-red-400" /><p className="text-[10px] text-gray-400">已排除候选可在候选页查看逐项原因。</p></div>}</div></aside>
    </div>
  </section>;
}
