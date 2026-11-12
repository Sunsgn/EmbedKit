import { Fragment, type ReactNode, useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, Clipboard, Download, FileText, Search, ShieldCheck, Wrench } from 'lucide-react';
import { embeddedKnowledgeCategories, embeddedKnowledgeDocuments, knowledgeMatchSnippet, resolveEmbeddedKnowledgeLink, searchEmbeddedKnowledge, type EmbeddedKnowledgeDocument } from '../../data/embeddedKnowledgeBase';
import { parseMarkdownBlocks } from './markdownDocument';
import KnowledgeExperienceWorkspace from './KnowledgeExperienceWorkspace';

function inlineContent(text: string, current: EmbeddedKnowledgeDocument, openDocument: (document: EmbeddedKnowledgeDocument) => void): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className="rounded bg-black/30 px-1 py-0.5 text-[0.92em] text-cyan-300">{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="font-semibold text-gray-200">{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const target = resolveEmbeddedKnowledgeLink(current, link[2]);
      if (target) return <button key={index} type="button" onClick={() => openDocument(target)} className="text-blue-400 underline decoration-blue-500/40 underline-offset-2 hover:text-blue-300">{link[1]}</button>;
      if (/^https:\/\//i.test(link[2])) return <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline decoration-blue-500/40 underline-offset-2">{link[1]}</a>;
      return <span key={index} className="text-gray-400">{link[1]}</span>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function MarkdownReader({ document, onOpenDocument }: { document: EmbeddedKnowledgeDocument; onOpenDocument: (document: EmbeddedKnowledgeDocument) => void }) {
  const blocks = useMemo(() => parseMarkdownBlocks(document.content), [document.content]);
  return <div className="space-y-4 text-sm leading-7 text-gray-400">
    {blocks.map((block, index) => {
      if (index === 0 && block.type === 'heading' && block.level === 1) return null;
      if (block.type === 'heading') {
        const className = block.level === 2 ? 'border-b border-[#30363d] pb-2 pt-3 text-lg font-semibold text-gray-100' : block.level === 3 ? 'pt-2 text-base font-semibold text-gray-200' : 'pt-1 text-sm font-semibold text-gray-300';
        return <h2 key={index} className={className}>{inlineContent(block.text, document, onOpenDocument)}</h2>;
      }
      if (block.type === 'paragraph') return <p key={index}>{inlineContent(block.text, document, onOpenDocument)}</p>;
      if (block.type === 'quote') return <blockquote key={index} className="border-l-2 border-blue-500/50 bg-blue-500/5 px-4 py-2 text-gray-400">{inlineContent(block.text, document, onOpenDocument)}</blockquote>;
      if (block.type === 'rule') return <hr key={index} className="border-[#30363d]" />;
      if (block.type === 'code') return <div key={index} className="overflow-hidden rounded-lg border border-[#30363d] bg-[#090d12]"><div className="border-b border-[#20262e] px-3 py-1 text-[9px] uppercase text-gray-600">{block.language || 'text'}</div><pre className="overflow-x-auto p-3 text-xs leading-5 text-gray-300"><code>{block.text}</code></pre></div>;
      if (block.type === 'list') {
        const Tag = block.ordered ? 'ol' : 'ul';
        return <Tag key={index} className={`space-y-1 pl-6 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>{block.items.map((item, itemIndex) => <li key={itemIndex} className="pl-1">{inlineContent(item, document, onOpenDocument)}</li>)}</Tag>;
      }
      return <div key={index} className="overflow-x-auto rounded-lg border border-[#30363d]"><table className="min-w-full border-collapse text-left text-xs"><thead className="bg-white/[0.04] text-gray-300"><tr>{block.headers.map((cell, cellIndex) => <th key={cellIndex} className="border-b border-r border-[#30363d] px-3 py-2 last:border-r-0">{inlineContent(cell, document, onOpenDocument)}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-[#20262e] last:border-0">{block.headers.map((_, cellIndex) => <td key={cellIndex} className="border-r border-[#20262e] px-3 py-2 align-top last:border-r-0">{inlineContent(row[cellIndex] ?? '', document, onOpenDocument)}</td>)}</tr>)}</tbody></table></div>;
    })}
  </div>;
}

export default function EmbeddedKnowledgeBase() {
  const [workspace, setWorkspace] = useState<'library' | 'experiences'>(() => localStorage.getItem('embedkit.knowledge-workspace') === 'experiences' ? 'experiences' : 'library');
  const [query, setQuery] = useState(''), [category, setCategory] = useState('');
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem('embedkit.knowledge-selected') ?? 'overview');
  const [notice, setNotice] = useState('');
  const filtered = useMemo(() => searchEmbeddedKnowledge(query, category), [category, query]);
  const selected = embeddedKnowledgeDocuments.find(document => document.id === selectedId) ?? embeddedKnowledgeDocuments[0];
  useEffect(() => localStorage.setItem('embedkit.knowledge-selected', selected.id), [selected.id]);
  useEffect(() => localStorage.setItem('embedkit.knowledge-workspace', workspace), [workspace]);
  const openDocument = (document: EmbeddedKnowledgeDocument) => { setSelectedId(document.id); setNotice(''); };
  const copyDocument = async () => {
    try { await navigator.clipboard.writeText(selected.content); setNotice('已复制当前 Markdown'); }
    catch { setNotice('浏览器未授予剪贴板权限，可使用导出'); }
  };
  const downloadDocument = () => {
    const url = URL.createObjectURL(new Blob([selected.content], { type: 'text/markdown;charset=utf-8' }));
    const link = window.document.createElement('a'); link.href = url; link.download = `${selected.title}.md`; link.click(); URL.revokeObjectURL(url); setNotice('已导出当前 Markdown');
  };

  return <section aria-label="嵌入式开发知识库" className="overflow-hidden rounded-xl border border-[#30363d] bg-[#111820]">
    <header className="border-b border-[#30363d] p-4 lg:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100"><BookOpen size={20} className="text-green-400" />嵌入式产品开发知识库</h2><p className="mt-1 text-xs text-gray-500">通用方法、MCU/RTOS、Linux、通信、测试、案例与 AI 执行约束；内容随仓库版本离线发布。</p></div><div className="flex flex-wrap gap-2 text-[10px]"><span className="rounded-full border border-green-500/20 bg-green-500/5 px-2.5 py-1 text-green-400"><ShieldCheck size={11} className="mr-1 inline" />本地内置</span><span className="rounded-full border border-[#30363d] px-2.5 py-1 text-gray-500">{embeddedKnowledgeDocuments.length} 份文档</span></div></div><nav aria-label="知识库工作区" className="mt-4 flex gap-2"><button type="button" onClick={() => setWorkspace('library')} className={`flex items-center gap-1.5 rounded px-3 py-2 text-xs ${workspace === 'library' ? 'bg-green-600 text-white' : 'border border-[#30363d] text-gray-400'}`}><BookOpen size={13} />内置知识</button><button type="button" onClick={() => setWorkspace('experiences')} className={`flex items-center gap-1.5 rounded px-3 py-2 text-xs ${workspace === 'experiences' ? 'bg-purple-600 text-white' : 'border border-[#30363d] text-gray-400'}`}><Wrench size={13} />本地工程经验</button></nav></header>
    {workspace === 'experiences' ? <KnowledgeExperienceWorkspace /> : <div className="grid min-h-[620px] lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="border-b border-[#30363d] p-4 lg:border-b-0 lg:border-r"><label className="relative block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" /><input aria-label="搜索知识库" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索 ISR、DTS、OTA、证据或发布…" className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] py-2 pl-9 pr-3 text-xs outline-none focus:border-green-500" /></label><select aria-label="知识分类" value={category} onChange={event => setCategory(event.target.value)} className="mt-2 w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs"><option value="">全部分类</option>{embeddedKnowledgeCategories.map(item => <option key={item}>{item}</option>)}</select><div className="mt-3 max-h-[510px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">{filtered.map(document => <button key={document.id} type="button" onClick={() => openDocument(document)} className={`w-full rounded-lg border p-3 text-left ${selected.id === document.id ? 'border-green-500/40 bg-green-500/10' : 'border-[#30363d] bg-[#0d1117] hover:border-[#484f58]'}`}><div className="flex items-start justify-between gap-2"><b className="text-xs text-gray-200">{document.title}</b><span className="shrink-0 rounded bg-white/[0.04] px-1.5 py-0.5 text-[8px] text-gray-600">{document.category}</span></div><p className="mt-1.5 line-clamp-3 text-[10px] leading-4 text-gray-600">{knowledgeMatchSnippet(document, query)}</p></button>)}{!filtered.length && <div className="rounded-lg border border-dashed border-[#30363d] py-8 text-center text-xs text-gray-600">没有匹配内容；可清除搜索或分类后重试</div>}</div></aside>
      <article className="min-w-0 bg-[#0d1117]"><header className="sticky top-0 z-10 border-b border-[#30363d] bg-[#0d1117]/95 p-4 backdrop-blur"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold text-gray-100">{selected.title}</h2><span className={`rounded px-2 py-0.5 text-[9px] ${selected.evidence === '真实项目盘点' ? 'bg-yellow-500/10 text-yellow-300' : selected.evidence === '执行约束' ? 'bg-red-500/10 text-red-300' : 'bg-blue-500/10 text-blue-300'}`}>{selected.evidence}</span></div><p className="mt-1 text-xs text-gray-500">{selected.summary}</p><p className="mt-1 truncate font-mono text-[9px] text-gray-700">{selected.sourcePath}</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => void copyDocument()} className="flex items-center gap-1 rounded border border-[#30363d] px-2.5 py-1.5 text-[10px] text-gray-400 hover:text-white"><Clipboard size={11} />复制</button><button type="button" onClick={downloadDocument} className="flex items-center gap-1 rounded border border-[#30363d] px-2.5 py-1.5 text-[10px] text-gray-400 hover:text-white"><Download size={11} />导出</button></div></div>{notice && <p role="status" className="mt-2 flex items-center gap-1 text-[10px] text-green-400"><Check size={11} />{notice}</p>}</header><div className="max-h-[680px] overflow-y-auto p-5 scrollbar-thin lg:p-7"><MarkdownReader document={selected} onOpenDocument={openDocument} /><footer className="mt-8 border-t border-[#30363d] pt-4 text-[10px] text-gray-700"><FileText size={11} className="mr-1 inline" />内容来源于仓库 Markdown；案例参数仅在原项目边界内有效，实机结论仍需对应证据。</footer></div></article>
    </div>}
  </section>;
}
