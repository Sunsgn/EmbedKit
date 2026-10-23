import { useMemo, useState } from 'react';
import { Calculator, ChevronRight, Clock3, Search, Star, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { loadToolPreferences, recordRecentTool, toggleToolFavorite } from '../services/toolPreferences';
import { toolRegistry } from '../tools/registry';
import type { ToolCategory, ToolDefinition } from '../tools/types';

const categories: Array<{ id: ToolCategory | 'all'; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'conversion', label: '转换' },
  { id: 'protocol', label: '协议' },
  { id: 'calculation', label: '计算' },
  { id: 'firmware', label: '固件' },
  { id: 'analysis', label: '分析' },
];
const primaryToolIds = ['number', 'crc', 'crypto'];

function ToolCards({ tools, label, favorites, onOpen, onFavorite }: { tools: ToolDefinition[]; label: string; favorites: string[]; onOpen: (id: string) => void; onFavorite: (id: string) => void }) {
  return <nav aria-label={label} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{tools.map(({ id, title, description, icon: Icon, requiresAgent }) => <article key={id} className="group relative flex items-center gap-3 rounded-xl border border-[#30363d] bg-[#161b22] p-4 transition hover:-translate-y-0.5 hover:border-[#484f58]"><button type="button" onClick={() => onOpen(id)} aria-label={`打开${title}`} className="absolute inset-0 rounded-xl" /><span className="pointer-events-none flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0d1117] text-gray-500 group-hover:text-blue-400"><Icon size={18} /></span><span className="pointer-events-none min-w-0 flex-1"><b className="block text-sm text-gray-200">{title}</b><small className="mt-1 block text-[11px] text-gray-600">{description}</small><span className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[9px] ${requiresAgent ? 'bg-yellow-500/10 text-yellow-400' : 'bg-green-500/10 text-green-400'}`}>{requiresAgent ? '需要本地助手' : '浏览器直接使用'}</span></span><div className="relative z-10 flex flex-col items-center gap-2"><button type="button" onClick={() => onFavorite(id)} aria-label={favorites.includes(id) ? `取消收藏${title}` : `收藏${title}`} className={favorites.includes(id) ? 'text-yellow-400' : 'text-gray-700 hover:text-yellow-400'}><Star size={15} fill={favorites.includes(id) ? 'currentColor' : 'none'} /></button><ChevronRight size={14} className="pointer-events-none text-gray-700 group-hover:text-gray-400" /></div></article>)}</nav>;
}

export default function ToolboxPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState(''), [category, setCategory] = useState<ToolCategory | 'all'>('all'), [preferences, setPreferences] = useState(loadToolPreferences);
  const filtered = useMemo(() => { const keyword = query.trim().toLocaleLowerCase(); return toolRegistry.filter(tool => (category === 'all' || tool.category === category) && (!keyword || [tool.title, tool.description, tool.detail, ...tool.keywords].some(value => value.toLocaleLowerCase().includes(keyword)))); }, [category, query]);
  const recent = preferences.recent.map(id => toolRegistry.find(tool => tool.id === id)).filter((tool): tool is ToolDefinition => Boolean(tool));
  const primary = primaryToolIds.map(id => toolRegistry.find(tool => tool.id === id)).filter((tool): tool is ToolDefinition => Boolean(tool));
  const additional = toolRegistry.filter(tool => !primaryToolIds.includes(tool.id));
  const openTool = (id: string) => { setPreferences(recordRecentTool(id)); navigate(`/toolbox/${id}`); };
  const toggleFavorite = (id: string) => setPreferences(toggleToolFavorite(id));
  const catalog = (tools: ToolDefinition[], label: string) => <ToolCards tools={tools} label={label} favorites={preferences.favorites} onOpen={openTool} onFavorite={toggleFavorite} />;
  const browsingAll = !query && category === 'all';

  return <div className="h-full overflow-y-auto p-5 scrollbar-thin lg:p-8"><div className="mx-auto max-w-7xl"><header className="mb-6"><div className="mb-2 flex items-center gap-2 text-xs text-orange-400"><Wrench size={15} /> EMBEDDED UTILITIES</div><h1 className="text-2xl font-bold">嵌入式工具箱</h1><p className="mt-2 text-sm text-gray-500">优先提供日常高频的数据转换、校验和密码算法；其他确定性工具仍可独立使用。</p></header>
    <section className="mb-5 rounded-xl border border-[#30363d] bg-[#161b22] p-3"><label className="flex items-center gap-2 rounded-lg border border-[#30363d] bg-[#0d1117] px-3"><Search size={14} className="text-gray-600" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索 CRC、AES、CAN、HEX、MAP…" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-gray-700" /></label><div className="mt-3 flex flex-wrap gap-2">{categories.map(item => <button key={item.id} onClick={() => setCategory(item.id)} className={`rounded-full px-3 py-1 text-[11px] ${category === item.id ? 'bg-blue-500/20 text-blue-300' : 'bg-[#0d1117] text-gray-500 hover:text-gray-300'}`}>{item.label}</button>)}</div></section>
    {browsingAll && recent.length > 0 && <section className="mb-5"><h2 className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-400"><Clock3 size={13} />最近使用</h2><div className="flex flex-wrap gap-2">{recent.map(tool => <button key={tool.id} onClick={() => openTool(tool.id)} className="rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-2 text-xs text-gray-400 hover:border-blue-500/30 hover:text-white">{tool.title}</button>)}</div></section>}
    {browsingAll ? <>
      <section className="mb-6"><h2 className="mb-3 text-sm font-semibold text-gray-200">常用转换、校验与密码工具</h2>{catalog(primary, '常用工具目录')}</section>
      <section><h2 className="mb-3 text-sm font-semibold text-gray-400">更多嵌入式工具</h2>{catalog(additional, '更多工具目录')}</section>
    </> : <>{filtered.length > 0 && catalog(filtered, '嵌入式工具目录')}</>}
    {filtered.length === 0 && <div className="rounded-xl border border-dashed border-[#30363d] p-8 text-center"><Search size={24} className="mx-auto mb-3 text-gray-700" /><p className="text-sm text-gray-400">没有找到匹配的工具</p><button onClick={() => { setQuery(''); setCategory('all'); }} className="mt-3 text-xs text-blue-400">清除筛选</button></div>}
    <div className="mt-5 rounded-xl border border-dashed border-[#30363d] p-4 text-center text-xs text-gray-600"><Calculator size={15} className="mr-2 inline" />{toolRegistry.length} 个工具均可离线独立使用；密码、文件与文本只在浏览器本地处理。</div>
  </div></div>;
}
