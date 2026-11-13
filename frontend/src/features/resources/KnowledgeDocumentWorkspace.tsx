import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, FileUp, Search, Square, Trash2 } from 'lucide-react';
import type { EmbeddedKnowledgeDocument } from '../../data/embeddedKnowledgeBase';
import { deleteKnowledgeDocument, importKnowledgeDocument, KNOWLEDGE_DOCUMENT_BATCH_LIMIT, KNOWLEDGE_DOCUMENT_MAX_COUNT, KNOWLEDGE_DOCUMENT_TOTAL_TEXT_BYTES, knowledgeDocumentSnippet, listKnowledgeDocuments, searchKnowledgeDocuments, type KnowledgeDocumentRecord } from '../../services/knowledgeDocumentLibrary';
import KnowledgeMarkdownReader from './KnowledgeMarkdownReader';

const PREVIEW_CHAR_LIMIT = 200_000;
const kindLabel: Record<KnowledgeDocumentRecord['kind'], string> = { markdown: 'Markdown', text: '文本', pdf: 'PDF 文本层', docx: 'DOCX', xlsx: 'XLSX' };

export default function KnowledgeDocumentWorkspace() {
  const [records, setRecords] = useState<KnowledgeDocumentRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [progress, setProgress] = useState('正在读取本地文档库…');
  const [notice, setNotice] = useState(''), [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const filtered = useMemo(() => searchKnowledgeDocuments(records, query), [query, records]);
  const selected = records.find(record => record.id === selectedId) ?? filtered[0] ?? records[0];
  const totalBytes = records.reduce((total, record) => total + record.textBytes, 0);
  const markdownPreview = useMemo<EmbeddedKnowledgeDocument | null>(() => selected?.kind === 'markdown' ? { id: selected.id, title: selected.title, category: '知识导航', summary: '用户导入的本地 Markdown', tags: [], sourcePath: `local-import/${selected.fileName}`, content: selected.content.slice(0, PREVIEW_CHAR_LIMIT), evidence: '通用归纳' } : null, [selected]);

  const refresh = async (preferredId = '') => {
    const next = await listKnowledgeDocuments();
    setRecords(next);
    setSelectedId(current => preferredId || (next.some(record => record.id === current) ? current : next[0]?.id ?? ''));
  };

  useEffect(() => {
    let active = true;
    void listKnowledgeDocuments().then(next => { if (active) { setRecords(next); setSelectedId(next[0]?.id ?? ''); setProgress(''); } }).catch(reason => { if (active) { setError(reason instanceof Error ? reason.message : String(reason)); setProgress(''); } });
    return () => { active = false; controller.current?.abort(); };
  }, []);

  const chooseFiles = async (files: File[]) => {
    setError(''); setNotice('');
    if (!files.length) return;
    if (files.length > KNOWLEDGE_DOCUMENT_BATCH_LIMIT) { setError(`单次最多导入 ${KNOWLEDGE_DOCUMENT_BATCH_LIMIT} 份文档，请分批处理`); return; }
    const current = new AbortController(); controller.current = current; setImporting(true);
    let imported = 0, duplicates = 0, lastId = '';
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setProgress(`正在处理 ${index + 1}/${files.length}：${file.name}`);
        const result = await importKnowledgeDocument(file, message => setProgress(`${index + 1}/${files.length}：${message}`), current.signal);
        if (result.duplicate) duplicates += 1; else imported += 1;
        lastId = result.record.id;
      }
      await refresh(lastId);
      setNotice(`已导入 ${imported} 份文档${duplicates ? `，跳过 ${duplicates} 份重复内容` : ''}`);
    } catch (reason) {
      await refresh(lastId);
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally { controller.current = null; setImporting(false); setProgress(''); }
  };

  const remove = async (record: KnowledgeDocumentRecord) => {
    if (!confirm(`确认删除“${record.title}”的本地提取文本？需要保留时请先导出。`)) return;
    setError(''); setNotice('');
    try { await deleteKnowledgeDocument(record.id); await refresh(); setNotice('文档已从当前浏览器删除'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  const download = (record: KnowledgeDocumentRecord) => {
    const metadata = `# ${record.title}\n\n- 来源文件：${record.fileName}\n- SHA-256：${record.sha256}\n- 导入时间：${record.addedAt}\n- 内容类型：${kindLabel[record.kind]}\n\n`;
    const url = URL.createObjectURL(new Blob([metadata, record.content], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${record.title}-本地提取.md`; link.click(); URL.revokeObjectURL(url); setNotice('已导出完整提取文本和来源哈希');
  };

  return <div className="theme-canvas grid min-h-[620px] lg:grid-cols-[340px_minmax(0,1fr)]">
    <aside className="border-b border-[#30363d] p-4 lg:border-b-0 lg:border-r">
      <label className="relative block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" /><input aria-label="搜索导入文档" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索标题或文档全文…" className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] py-2 pl-9 pr-3 text-xs outline-none focus:border-cyan-500" /></label>
      <div className="mt-3 flex flex-wrap items-center gap-2"><label className={`flex items-center gap-1 rounded border border-cyan-500/30 px-2.5 py-1.5 text-[10px] text-cyan-300 ${importing ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}><FileUp size={11} />导入 Markdown/文档<input aria-label="选择知识库文档" type="file" multiple disabled={importing} accept=".md,.markdown,.txt,.csv,.tsv,.json,.pdf,.docx,.xlsx,text/plain,text/markdown,text/csv,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={event => { void chooseFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} /></label>{importing && <button type="button" onClick={() => controller.current?.abort()} className="flex items-center gap-1 rounded border border-red-500/30 px-2.5 py-1.5 text-[10px] text-red-300"><Square size={10} />停止</button>}</div>
      <p className="mt-2 text-[9px] leading-4 text-gray-700">首选 Markdown，可直接渲染标题、列表、表格和代码块；兼容 TXT/CSV/TSV/JSON、PDF文本层、DOCX、XLSX。全部在浏览器本地处理，不上传。最多 {KNOWLEDGE_DOCUMENT_MAX_COUNT} 份、文本总量 {KNOWLEDGE_DOCUMENT_TOTAL_TEXT_BYTES / 1024 / 1024} MiB、单批 {KNOWLEDGE_DOCUMENT_BATCH_LIMIT} 份。</p>
      {progress && <p role="status" className="mt-2 text-[10px] text-cyan-400">{progress}</p>}
      <div className="mt-3 max-h-[430px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">{filtered.map(record => <button key={record.id} type="button" onClick={() => { setSelectedId(record.id); setNotice(''); setError(''); }} className={`w-full rounded-lg border p-3 text-left ${selected?.id === record.id ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-[#30363d] bg-[#0d1117] hover:border-[#484f58]'}`}><div className="flex items-start justify-between gap-2"><b className="text-xs text-gray-200">{record.title}</b><span className="shrink-0 text-[8px] text-cyan-400">{kindLabel[record.kind]}</span></div><p className="mt-1.5 line-clamp-3 text-[10px] leading-4 text-gray-600">{knowledgeDocumentSnippet(record, query)}</p></button>)}{!filtered.length && <p className="rounded-lg border border-dashed border-[#30363d] py-8 text-center text-xs text-gray-600">{records.length ? '没有匹配文档' : '尚未导入文档'}</p>}</div>
      <p className="mt-3 border-t border-[#30363d] pt-3 text-[9px] text-gray-700">本地文档：{records.length} 份 · 提取文本：{(totalBytes / 1024 / 1024).toFixed(2)} MiB</p>
    </aside>
    <article className="theme-canvas min-w-0">
      {selected ? <><header className="theme-canvas sticky top-0 z-10 border-b border-[#30363d] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-lg font-semibold text-gray-100">{selected.title}</h3><p className="mt-1 truncate text-[10px] text-gray-600">{selected.fileName} · {selected.units} {selected.unitLabel} · SHA-256 {selected.sha256.slice(0, 16)}…</p></div><div className="flex gap-2"><button type="button" onClick={() => download(selected)} className="flex items-center gap-1 rounded border border-[#30363d] px-2.5 py-1.5 text-[10px] text-gray-400"><Download size={11} />导出文本</button><button type="button" aria-label={`删除导入文档 ${selected.title}`} onClick={() => void remove(selected)} className="flex items-center gap-1 rounded border border-red-500/30 px-2.5 py-1.5 text-[10px] text-red-300"><Trash2 size={11} />删除</button></div></div>{selected.warnings.length > 0 && <p className="mt-2 text-[10px] text-yellow-400">{selected.warnings.join('；')}</p>}</header><div className="max-h-[680px] overflow-y-auto p-5 scrollbar-thin">{markdownPreview ? <KnowledgeMarkdownReader document={markdownPreview} onOpenDocument={() => undefined} /> : <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-gray-400">{selected.content.slice(0, PREVIEW_CHAR_LIMIT)}</pre>}{selected.content.length > PREVIEW_CHAR_LIMIT && <p className="mt-4 rounded border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-300">预览仅显示前 {PREVIEW_CHAR_LIMIT.toLocaleString()} 个字符；搜索和导出仍使用完整文本。</p>}</div></> : <div className="flex min-h-[620px] flex-col items-center justify-center p-8 text-center text-gray-600"><FileText size={32} /><h3 className="mt-3 text-sm text-gray-400">导入本地技术文档</h3><p className="mt-1 max-w-md text-xs leading-5">优先导入 Markdown；导入后可全文检索、渲染阅读、查看来源哈希、导出或删除。</p></div>}
      {error && <p role="alert" className="m-4 rounded border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">{error}。已成功导入的文档会保留，可修复文件后重试。</p>}{notice && <p role="status" className="m-4 rounded border border-green-500/30 bg-green-500/5 p-3 text-xs text-green-300">{notice}</p>}
    </article>
  </div>;
}
