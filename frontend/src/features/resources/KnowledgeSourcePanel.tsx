import { useMemo, useState } from 'react';
import { BookMarked, ExternalLink, Search, ShieldCheck } from 'lucide-react';
import { embeddedSourceCategories, embeddedSources } from '../../data/embeddedSources';

export default function KnowledgeSourcePanel() {
  const [query, setQuery] = useState(''), [category, setCategory] = useState('');
  const filtered = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return embeddedSources.filter(source => (!category || source.category === category) && tokens.every(token => `${source.title} ${source.organization} ${source.description} ${source.scope} ${source.tags.join(' ')}`.toLowerCase().includes(token)));
  }, [category, query]);

  return <details className="mb-5 overflow-hidden rounded-xl border border-[#30363d] bg-[#161b22]">
    <summary className="flex cursor-pointer list-none items-center gap-3 p-4"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 text-green-400"><BookMarked size={18} /></span><span className="min-w-0 flex-1"><b className="block text-sm text-gray-200">通用嵌入式开发资料导航</b><small className="text-[11px] text-gray-500">官方文档优先 · 来源与适用范围可追溯 · 点击展开</small></span><span className="rounded-full border border-green-500/20 bg-green-500/5 px-2.5 py-1 text-[10px] text-green-400">{embeddedSources.length} 个已验证来源</span></summary>
    <div className="border-t border-[#30363d] p-4"><div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px]"><label className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索 CMSIS、RTOS、GDB、构建或调试…" className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] py-2 pl-9 pr-3 text-xs outline-none focus:border-green-500" /></label><select value={category} onChange={event => setCategory(event.target.value)} className="rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs"><option value="">全部资料类别</option>{embeddedSourceCategories.map(item => <option key={item}>{item}</option>)}</select></div>
      <div className="mb-3 flex items-center gap-2 text-[10px] text-gray-600"><ShieldCheck size={12} className="text-green-500" />当前目录优先收录项目、标准组织和厂商官方资料；社区资料后续单独标记。</div>
      {filtered.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map(source => <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3 hover:border-green-500/40"><div className="flex items-start justify-between gap-2"><div><b className="text-xs text-gray-200">{source.title}</b><p className="mt-0.5 text-[10px] text-green-400">{source.organization} · {source.category}</p></div><ExternalLink size={12} className="shrink-0 text-gray-600" /></div><p className="mt-2 text-[11px] leading-5 text-gray-500">{source.description}</p><p className="mt-2 border-t border-[#20262e] pt-2 text-[10px] text-gray-600">适用：{source.scope}</p><div className="mt-2 flex flex-wrap gap-1">{source.tags.slice(0, 4).map(tag => <span key={tag} className="rounded bg-[#161b22] px-1.5 py-0.5 text-[9px] text-gray-500">{tag}</span>)}</div><p className="mt-2 text-[9px] text-gray-700">{source.language} · 链接验证 {source.verifiedAt}</p></a>)}</div> : <div className="rounded-lg border border-dashed border-[#30363d] py-8 text-center text-xs text-gray-600">没有匹配的已验证资料来源</div>}
    </div>
  </details>;
}
