import { useState } from 'react';
import { Download, FolderOpen, History, Trash2 } from 'lucide-react';
import type { FunctionSolution } from '../../types';
import { deleteFunctionSolution, listFunctionSolutions } from './functionSolutions';

function exportRecord(solution: FunctionSolution) {
  const blob = new Blob([JSON.stringify(solution, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = `${solution.name.replace(/[^\w\u4e00-\u9fa5-]+/g, '-') || 'selection-record'}.json`; anchor.click(); URL.revokeObjectURL(url);
}

export default function FunctionSolutionRecords({ onOpen }: { onOpen: (solution: FunctionSolution) => void }) {
  const [records, setRecords] = useState(() => listFunctionSolutions());
  const [message, setMessage] = useState('');
  const remove = (solution: FunctionSolution) => {
    if (solution.migratedFrom) { setMessage('这是旧版兼容记录，请在原选型记录中删除，原始数据未被修改'); return; }
    if (!window.confirm(`删除功能方案“${solution.name}”？建议先导出备份。`)) return;
    try { deleteFunctionSolution(solution.id); setRecords(listFunctionSolutions()); setMessage('方案已删除'); } catch (reason) { setMessage(reason instanceof Error ? reason.message : '删除失败'); }
  };
  return <section className="rounded-xl border border-[#30363d] bg-[#161b22] p-4"><div className="mb-4 flex flex-wrap items-start justify-between gap-2"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-gray-200"><History size={16} className="text-purple-400" />我的资料与选型记录</h2><p className="mt-1 text-[11px] text-gray-500">保存的功能方案与旧版单器件选型记录；旧记录以单角色方案兼容打开。</p></div><span className="rounded bg-[#0d1117] px-2 py-1 text-[10px] text-gray-500">{records.length} 条</span></div>{message && <p role="status" className="mb-3 rounded border border-blue-500/20 bg-blue-500/5 p-2 text-[11px] text-blue-300">{message}</p>}{records.length === 0 ? <div className="rounded-lg border border-dashed border-[#30363d] py-14 text-center text-xs text-gray-600">尚无选型记录。可在“按功能设计方案”中保存。</div> : <div className="grid gap-3 lg:grid-cols-2">{records.map(solution => <article key={solution.id} className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="truncate text-sm text-gray-200">{solution.name}</b>{solution.migratedFrom && <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[9px] text-yellow-300">旧版兼容</span>}</div><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-gray-600">{solution.description || '未填写功能描述'}</p></div><span className="shrink-0 text-[9px] text-gray-600">{new Date(solution.updatedAt).toLocaleString()}</span></div><div className="mt-3 flex flex-wrap gap-2 text-[10px] text-gray-500"><span>{solution.roles.length} 个角色</span><span>·</span><span>{solution.parts.length} 个候选</span><span>·</span><span>{solution.roles.reduce((sum, role) => sum + role.constraints.length, 0)} 条条件</span></div><div className="mt-3 flex gap-2"><button onClick={() => onOpen(solution)} className="flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1.5 text-[10px] text-white"><FolderOpen size={12} />打开</button><button onClick={() => exportRecord(solution)} className="flex items-center gap-1 rounded border border-[#30363d] px-2.5 py-1.5 text-[10px] text-gray-300"><Download size={12} />导出</button><button onClick={() => remove(solution)} className="ml-auto flex items-center gap-1 rounded border border-[#30363d] px-2.5 py-1.5 text-[10px] text-gray-500 hover:text-red-400"><Trash2 size={12} />删除</button></div></article>)}</div>}</section>;
}
