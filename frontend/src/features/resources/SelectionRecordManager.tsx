import { useState } from 'react';
import { History, RotateCcw, Save, Trash2 } from 'lucide-react';
import type { PartRecord } from '../../types';
import type { PartSelectionEvaluation, SelectionCriterion } from './selectionEngine';
import { deletePartSelectionRecord, listPartSelectionRecords, savePartSelectionRecord, type PartSelectionRecord } from './selectionRecords';

interface Props {
  scope: string;
  name: string;
  criteria: SelectionCriterion[];
  parts: PartRecord[];
  evaluations: PartSelectionEvaluation[];
  onRestore: (record: PartSelectionRecord) => void;
}

export default function SelectionRecordManager({ scope, name, criteria, parts, evaluations, onRestore }: Props) {
  const readRecords = () => listPartSelectionRecords().filter(item => item.scope === scope);
  const [records, setRecords] = useState(readRecords), [message, setMessage] = useState('');
  const save = () => { try { savePartSelectionRecord({ name, scope, criteria, parts, evaluations }); setRecords(readRecords()); setMessage('当前选型及证据已保存'); } catch (reason) { setMessage(reason instanceof Error ? reason.message : '保存失败'); } };
  const remove = (record: PartSelectionRecord) => { if (!window.confirm(`删除选型记录“${record.name}”？此操作不会删除导出的文件。`)) return; deletePartSelectionRecord(record.id); setRecords(readRecords()); setMessage('记录已删除'); };
  return <div className="border-b border-[#30363d] px-4 py-3"><div className="flex flex-wrap items-center gap-2"><button onClick={save} className="flex items-center gap-1.5 rounded border border-green-500/30 bg-green-500/5 px-3 py-1.5 text-xs text-green-300"><Save size={13} />保存当前选型</button><details className="relative"><summary className="flex cursor-pointer list-none items-center gap-1.5 rounded border border-[#30363d] px-3 py-1.5 text-xs text-gray-300"><History size={13} />选型记录 {records.length}</summary><div className="absolute left-0 top-9 z-20 w-[min(560px,80vw)] space-y-2 rounded-lg border border-[#30363d] bg-[#161b22] p-3 shadow-xl">{records.length ? records.map(record => <div key={record.id} className="flex items-center gap-2 rounded border border-[#30363d] bg-[#0d1117] p-2"><div className="min-w-0 flex-1"><b className="block truncate text-xs text-gray-300">{record.name}</b><span className="text-[9px] text-gray-600">{new Date(record.updatedAt).toLocaleString()} · {record.parts.length} 个候选</span></div><button onClick={() => onRestore(record)} title="恢复记录" className="rounded p-1.5 text-blue-400 hover:bg-blue-500/10"><RotateCcw size={13} /></button><button onClick={() => remove(record)} title="删除记录" className="rounded p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button></div>) : <p className="py-5 text-center text-[10px] text-gray-600">还没有保存的选型记录</p>}</div></details>{message && <span role="status" className="text-[10px] text-gray-500">{message}</span>}</div></div>;
}
