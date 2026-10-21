import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle, Copy, Download, ExternalLink, FileSearch, Loader2, RefreshCw, Search, X } from 'lucide-react';
import type { DocumentExtractionResult } from '../../tools/frame/documentExtraction';
import { extractProtocolDocumentFile } from '../../tools/frame/documentExtraction';
import { readOfficialPartDocument } from '../../services/partSources';
import type { PartDocumentLink } from './partDocumentDiscovery';
import { analyzeDatasheetExtraction, searchDatasheetPages, type DatasheetAnalysis } from './datasheetAnalysis';

interface Props { model: string; document: PartDocumentLink; onClose: () => void }
type LoadState = 'downloading' | 'parsing' | 'ready' | 'error';

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob), anchor = window.document.createElement('a'); anchor.href = url; anchor.download = fileName; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFileName(model: string, title: string) {
  return `${model}-${title}`.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'official-document';
}

async function sha256(bytes: Uint8Array) {
  if (!crypto.subtle) return '浏览器不支持 SHA-256';
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export default function PartDocumentWorkspace({ model, document, onClose }: Props) {
  const [attempt, setAttempt] = useState(0), [state, setState] = useState<LoadState>('downloading'), [progress, setProgress] = useState('正在请求官方 PDF…'), [error, setError] = useState('');
  const [bytes, setBytes] = useState<Uint8Array>(), [blobUrl, setBlobUrl] = useState(''), [sourceUrl, setSourceUrl] = useState(document.url), [hash, setHash] = useState(''), [extraction, setExtraction] = useState<DocumentExtractionResult>(), [analysis, setAnalysis] = useState<DatasheetAnalysis>();
  const [selectedPage, setSelectedPage] = useState(1), [query, setQuery] = useState(''), [copied, setCopied] = useState(false);
  const fileBase = safeFileName(model, document.title), matches = useMemo(() => analysis ? searchDatasheetPages(analysis.pages, query) : [], [analysis, query]);
  const navigationItems = useMemo(() => query.trim().length >= 2 ? matches.map(item => ({ ...item, title: item.excerpt })) : analysis?.sections ?? [], [analysis, matches, query]);
  const selectedText = analysis?.pages.find(page => page.page === selectedPage)?.text ?? '';

  useEffect(() => {
    const controller = new AbortController(); let objectUrl = '';
    const load = async () => {
      try {
        const result = await readOfficialPartDocument(document.url, controller.signal);
        if (controller.signal.aborted) return;
        const blob = new Blob([result.bytes as BlobPart], { type: 'application/pdf' }); objectUrl = URL.createObjectURL(blob); setBytes(result.bytes); setBlobUrl(objectUrl); setSourceUrl(result.sourceUrl); setState('parsing');
        const hashPromise = sha256(result.bytes);
        const parsed = await extractProtocolDocumentFile(new File([blob], `${fileBase}.pdf`, { type: 'application/pdf' }), message => setProgress(message), controller.signal);
        if (controller.signal.aborted) return;
        setHash(await hashPromise); setExtraction(parsed); setAnalysis(analyzeDatasheetExtraction(parsed)); setState('ready'); setProgress('解析完成');
      } catch (reason) {
        if (controller.signal.aborted) return;
        setState('error'); setError(reason instanceof Error ? reason.message : '官方 PDF 读取失败');
      }
    };
    void load();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [attempt, document.url, fileBase]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey); return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const exportEvidence = () => {
    if (!analysis || !extraction) return;
    const report = { schema: 'embedkit.part-document-analysis', version: 1, model, document: { title: document.title, kind: document.kind, sourceName: document.sourceName, sourceUrl, scope: document.scope, sha256: hash, byteLength: bytes?.byteLength, extractedAt: extraction.extractedAt }, deterministicAnalysis: { pageCount: extraction.units, sectionCoverage: analysis.coverage, sections: analysis.sections, unknownSections: analysis.unknownSections, warnings: extraction.warnings } };
    saveBlob(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), `${fileBase}-evidence.json`);
  };
  const copyPage = async () => { if (!selectedText) return; await navigator.clipboard.writeText(`[来源: ${sourceUrl}，PDF 第 ${selectedPage} 页]\n${selectedText}`); setCopied(true); window.setTimeout(() => setCopied(false), 1500); };
  const retry = () => { setState('downloading'); setProgress('正在通过 Local Agent 读取官方 PDF…'); setError(''); setBytes(undefined); setBlobUrl(''); setExtraction(undefined); setAnalysis(undefined); setHash(''); setSelectedPage(1); setQuery(''); setAttempt(value => value + 1); };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-2 lg:p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-label={`${model} 详细资料阅读器`} className="flex h-[96vh] w-full max-w-[1800px] flex-col overflow-hidden rounded-xl border border-[#30363d] bg-[#0d1117] shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#30363d] bg-[#161b22] px-4 py-3">
          <div className="min-w-0"><div className="flex items-center gap-2"><BookOpen size={18} className="text-blue-400" /><h2 className="truncate text-sm font-semibold text-gray-100">{model} · {document.title}</h2></div><p className="mt-1 truncate text-[10px] text-gray-500">{document.sourceName} · {document.scope === 'exact-model' ? '精确型号资料' : '系列资料，使用前核对适用范围'}</p></div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {state === 'ready' && <><button onClick={exportEvidence} className="flex items-center gap-1 rounded border border-[#30363d] px-2.5 py-1.5 text-gray-300"><Download size={12} />导出证据</button>{bytes && <button onClick={() => saveBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${fileBase}.pdf`)} className="flex items-center gap-1 rounded border border-blue-500/30 px-2.5 py-1.5 text-blue-300"><Download size={12} />下载 PDF</button>}</>}
            <a href={document.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded border border-[#30363d] px-2.5 py-1.5 text-gray-400"><ExternalLink size={12} />官方原址</a>
            <button onClick={onClose} aria-label="关闭详细资料阅读器" className="rounded p-1.5 text-gray-400 hover:bg-white/5 hover:text-white"><X size={18} /></button>
          </div>
        </header>

        {(state === 'downloading' || state === 'parsing') && <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center"><Loader2 size={30} className="animate-spin text-blue-400" /><div><p className="text-sm text-gray-200">{progress}</p><p className="mt-1 text-xs text-gray-600">关闭工作区可取消；PDF 最大 50 MiB、最多解析 1,000 页。</p></div></div>}
        {state === 'error' && <div className="flex flex-1 items-center justify-center p-6"><div className="max-w-xl rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center"><AlertTriangle className="mx-auto text-red-400" /><h3 className="mt-3 font-semibold text-gray-200">无法在平台内读取该 PDF</h3><p role="alert" className="mt-2 text-sm text-gray-400">{error}</p><p className="mt-2 text-xs text-gray-600">请确认 Local Agent 已更新并启动；也可以从“官方原址”继续查看。</p><button onClick={retry} className="mx-auto mt-4 flex items-center gap-1 rounded bg-blue-600 px-3 py-2 text-xs"><RefreshCw size={12} />重新读取</button></div></div>}

        {state === 'ready' && analysis && extraction && <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto xl:grid-cols-[280px_minmax(480px,1fr)_340px] xl:overflow-hidden">
          <aside className="border-b border-[#30363d] bg-[#11161d] p-3 xl:overflow-y-auto xl:border-b-0 xl:border-r">
            <label className="relative block"><Search size={14} className="absolute left-2.5 top-2.5 text-gray-600" /><input aria-label="搜索数据手册全文" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索参数、引脚或关键词" className="w-full rounded border border-[#30363d] bg-[#0d1117] py-2 pl-8 pr-2 text-xs outline-none focus:border-blue-500" /></label>
            <div className="mt-3 flex items-center justify-between text-[10px] text-gray-600"><span>{query.trim().length >= 2 ? `${matches.length} 个匹配` : `检测到 ${analysis.sections.length} 个章节`}</span><span>{extraction.units} 页</span></div>
            <div className="mt-2 space-y-1">
              {navigationItems.map(item => <button key={item.id} onClick={() => setSelectedPage(item.page)} className={`w-full rounded border p-2 text-left ${selectedPage === item.page ? 'border-blue-500/40 bg-blue-500/10' : 'border-transparent hover:bg-white/[0.03]'}`}><div className="flex items-center justify-between gap-2"><b className="truncate text-[11px] text-gray-300">{item.title}</b><span className="shrink-0 text-[9px] text-blue-400">P{item.page}</span></div>{query.trim().length < 2 && <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-gray-600">{item.excerpt}</p>}</button>)}
              {!query && !analysis.sections.length && <p className="rounded border border-dashed border-[#30363d] p-3 text-[10px] text-gray-600">未可靠识别章节标题，可通过全文搜索或页码查看。</p>}
            </div>
          </aside>

          <main className="flex min-h-[680px] flex-col border-b border-[#30363d] bg-[#20252b] xl:min-h-0 xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between border-b border-[#30363d] bg-[#161b22] px-3 py-2 text-xs"><span className="text-gray-400">官方原文 · 第 {selectedPage}/{extraction.units} 页</span><div className="flex gap-1"><button disabled={selectedPage <= 1} onClick={() => setSelectedPage(page => Math.max(1, page - 1))} className="rounded border border-[#30363d] px-2 py-1 disabled:opacity-30">上一页</button><button disabled={selectedPage >= extraction.units} onClick={() => setSelectedPage(page => Math.min(extraction.units, page + 1))} className="rounded border border-[#30363d] px-2 py-1 disabled:opacity-30">下一页</button></div></div>
            <iframe key={selectedPage} title={`${model} 官方 PDF 第 ${selectedPage} 页`} src={`${blobUrl}#page=${selectedPage}&zoom=page-width`} className="min-h-[620px] flex-1 bg-white" />
          </main>

          <aside className="space-y-3 bg-[#11161d] p-4 xl:overflow-y-auto">
            <section className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3"><div className="flex items-center justify-between"><b className="text-xs text-gray-200">确定性解析结果</b><span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-300">章节覆盖 {analysis.coverage}%</span></div><div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-gray-500"><span>文件：{(bytes!.byteLength / 1024 / 1024).toFixed(2)} MiB</span><span>页数：{extraction.units}</span><span className="col-span-2 break-all">SHA-256：{hash}</span></div></section>
            <section className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3"><div className="flex items-center justify-between"><b className="flex items-center gap-1 text-xs text-gray-200"><FileSearch size={13} />第 {selectedPage} 页文本证据</b><button onClick={() => void copyPage()} disabled={!selectedText} className="flex items-center gap-1 text-[10px] text-blue-400 disabled:opacity-30">{copied ? <CheckCircle size={11} /> : <Copy size={11} />}{copied ? '已复制' : '复制'}</button></div><pre className="mt-2 max-h-72 whitespace-pre-wrap break-words text-[10px] leading-5 text-gray-500">{selectedText || '该页没有可提取文本层，请以左侧 PDF 原图为准。'}</pre></section>
            <section className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3"><b className="text-xs text-gray-200">未识别或需人工核对</b><div className="mt-2 flex flex-wrap gap-1">{analysis.unknownSections.map(item => <span key={item} className="rounded bg-yellow-500/10 px-2 py-1 text-[9px] text-yellow-300">{item}</span>)}</div>{extraction.warnings.map(warning => <p key={warning} className="mt-2 text-[9px] leading-4 text-gray-600">{warning}</p>)}</section>
            <section className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3"><b className="text-xs text-gray-200">来源证据</b><p className="mt-2 break-all text-[9px] leading-4 text-gray-600">{sourceUrl}</p><p className="mt-1 text-[9px] text-gray-700">提取时间：{new Date(extraction.extractedAt).toLocaleString()}</p></section>
          </aside>
        </div>}
      </section>
    </div>
  );
}
