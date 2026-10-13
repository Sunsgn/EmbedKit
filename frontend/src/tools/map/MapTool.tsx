import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileUp, Search, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { buildMapComparisonEvidence, compareMapAnalyses, getMapModuleDrilldown, lookupMapAddress, type MapAddressLookup, type MapAnalysis, type MapDeltaItem } from '../../utils/mapAnalyzer';
import { readLocalFileBytes, revokeLocalPath } from '../../services/localFiles';
import { analyzeMapInBackground, MAX_MAP_ANALYSIS_BYTES, type MapAnalysisResult } from '../../services/mapAnalysisWorker';
import { parseBuildArtifactRouteState, routeStateContext, saveBuildAnalysisRecord, type BuildAnalysisContext } from '../../services/buildAnalysisRecords';
import BuildAnalysisAssociation from '../../features/project/BuildAnalysisAssociation';

const MAX_MAP_BYTES = MAX_MAP_ANALYSIS_BYTES;
const formatSize = (value: number) => value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(2)} MiB` : value >= 1024 ? `${(value / 1024).toFixed(2)} KiB` : `${value} B`;
const signedSize = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatSize(Math.abs(value))}`;
const hex = (value: number) => `0x${value.toString(16).toUpperCase()}`;
function Value({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg bg-[#0d1117] px-3 py-2"><span className="block text-[10px] text-gray-600">{label}</span><code className="mt-1 block break-all text-xs text-gray-200">{value}</code></div>; }
const csvCell = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;
function download(content: string, type: string, name: string) { const url = URL.createObjectURL(new Blob([content], { type })), link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }
function DeltaTable({ title, rows, onSelect, selected }: { title: string; rows: MapDeltaItem[]; onSelect?: (name: string) => void; selected?: string }) {
  return <div className="min-w-0"><h4 className="mb-1 text-[11px] text-gray-500">{title}</h4><div className="max-h-56 overflow-auto rounded border border-[#30363d]"><table className="w-full min-w-[420px] text-left text-[11px]"><thead className="sticky top-0 bg-[#0d1117] text-gray-600"><tr><th className="px-3 py-2">对象</th><th>基线</th><th>当前</th><th>变化</th></tr></thead><tbody>{rows.slice(0, 30).map(item => <tr key={item.name} onClick={() => onSelect?.(item.name)} className={`border-t border-[#30363d]/60 ${onSelect ? 'cursor-pointer hover:bg-blue-500/5' : ''} ${selected === item.name ? 'bg-blue-500/10' : ''}`}><td className="max-w-64 truncate px-3 py-2 text-gray-300" title={item.name}>{item.name}</td><td>{formatSize(item.before)}</td><td>{formatSize(item.after)}</td><td className={item.delta > 0 ? 'text-red-300' : 'text-green-300'}>{signedSize(item.delta)}</td></tr>)}</tbody></table>{!rows.length && <p className="p-3 text-center text-xs text-gray-600">没有可比较的差异</p>}</div></div>;
}

export default function MapTool() {
  const location = useLocation(), navigate = useNavigate(), consumedIncoming = useRef(false), activeAnalysis = useRef<AbortController | null>(null), activeBaselineAnalysis = useRef<AbortController | null>(null), skipNextSourceAnalysis = useRef(false);
  const [source, setSource] = useState(''), [address, setAddress] = useState(''), [lookup, setLookup] = useState<MapAddressLookup | null>(null), [lookupError, setLookupError] = useState('');
  const [fileName, setFileName] = useState(''), [error, setError] = useState(''), [progress, setProgress] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<MapAnalysis | null>(null), [analyzing, setAnalyzing] = useState(false), [execution, setExecution] = useState<MapAnalysisResult['execution'] | null>(null);
  const [baselineSource, setBaselineSource] = useState(''), [baselineFileName, setBaselineFileName] = useState(''), [baselineError, setBaselineError] = useState('');
  const [baselineAnalysis, setBaselineAnalysis] = useState<MapAnalysis | null>(null), [baselineAnalyzing, setBaselineAnalyzing] = useState(false), [selectedModule, setSelectedModule] = useState('');
  const [associationContext, setAssociationContext] = useState<BuildAnalysisContext | null>(null), [associationRevision, setAssociationRevision] = useState(0);
  const analyze = useCallback(async (text: string, controller: AbortController) => {
    setAnalyzing(true); setError(''); setLookup(null);
    try { const result = await analyzeMapInBackground(text, { signal: controller.signal }); setAnalysis(result.analysis); setExecution(result.execution); return result.analysis; }
    finally { if (activeAnalysis.current === controller) { activeAnalysis.current = null; setAnalyzing(false); } }
  }, []);
  const analyzeBaseline = useCallback(async (text: string, controller: AbortController) => {
    setBaselineAnalyzing(true); setBaselineError('');
    try { const result = await analyzeMapInBackground(text, { signal: controller.signal }); setBaselineAnalysis(result.analysis); return result.analysis; }
    finally { if (activeBaselineAnalysis.current === controller) { activeBaselineAnalysis.current = null; setBaselineAnalyzing(false); } }
  }, []);
  useEffect(() => {
    if (skipNextSourceAnalysis.current) { skipNextSourceAnalysis.current = false; return; }
    activeAnalysis.current?.abort();
    activeAnalysis.current = null;
    if (!source.trim()) return;
    const controller = new AbortController(); activeAnalysis.current = controller;
    const timer = window.setTimeout(() => { void analyze(source, controller).catch(reason => { if (reason instanceof DOMException && reason.name === 'AbortError') return; setAnalysis(null); setError(reason instanceof Error ? reason.message : String(reason)); }); }, 180);
    return () => { clearTimeout(timer); controller.abort(); if (activeAnalysis.current === controller) activeAnalysis.current = null; };
  }, [analyze, source]);
  useEffect(() => {
    activeBaselineAnalysis.current?.abort(); activeBaselineAnalysis.current = null;
    if (!baselineSource.trim()) return;
    const controller = new AbortController(); activeBaselineAnalysis.current = controller;
    const timer = window.setTimeout(() => { void analyzeBaseline(baselineSource, controller).catch(reason => { if (reason instanceof DOMException && reason.name === 'AbortError') return; setBaselineAnalysis(null); setBaselineError(reason instanceof Error ? reason.message : String(reason)); }); }, 180);
    return () => { clearTimeout(timer); controller.abort(); if (activeBaselineAnalysis.current === controller) activeBaselineAnalysis.current = null; };
  }, [analyzeBaseline, baselineSource]);
  useEffect(() => () => { activeAnalysis.current?.abort(); activeBaselineAnalysis.current?.abort(); }, []);
  const comparison = useMemo(() => analysis && baselineAnalysis ? compareMapAnalyses(analysis, baselineAnalysis) : null, [analysis, baselineAnalysis]);
  const drilldown = useMemo(() => analysis && baselineAnalysis && selectedModule ? getMapModuleDrilldown(analysis, baselineAnalysis, selectedModule) : null, [analysis, baselineAnalysis, selectedModule]);
  const locate = () => { if (!analysis) return; try { setLookup(lookupMapAddress(analysis, address)); setLookupError(''); } catch (error) { setLookup(null); setLookupError(error instanceof Error ? error.message : String(error)); } };
  const consumeSelection = useCallback(async (selectionId: string, incomingName: string, context: BuildAnalysisContext | null = null) => {
    setAssociationContext(context);
    setError(''); setLookup(null); setProgress(0);
    try {
      const { metadata, bytes } = await readLocalFileBytes(selectionId, MAX_MAP_BYTES, setProgress);
      const text = new TextDecoder('utf-8').decode(bytes), controller = new AbortController(); activeAnalysis.current?.abort(); activeAnalysis.current = controller;
      const parsed = await analyze(text, controller); skipNextSourceAnalysis.current = true;
      setSource(text); setFileName(incomingName || metadata.name); setProgress(100);
      if (context) { saveBuildAnalysisRecord(context, 'map', { summary: { format: parsed.formatLabel, coverage: parsed.coverage.score, confidence: parsed.coverage.confidence, flash: parsed.totals.flash, ram: parsed.totals.ram, modules: parsed.modules.length, symbols: parsed.symbols.length, optimizations: parsed.optimizations.length, warnings: parsed.warnings.length } }); setAssociationRevision(value => value + 1); }
    } catch (reason) { const message = reason instanceof Error ? reason.message : String(reason); setError(message); setProgress(null); if (context) { saveBuildAnalysisRecord(context, 'map', { error: message }); setAssociationRevision(value => value + 1); } }
    finally { await revokeLocalPath(selectionId).catch(() => undefined); }
  }, [analyze]);
  useEffect(() => {
    const incoming = parseBuildArtifactRouteState(location.state);
    if (consumedIncoming.current || !incoming) return;
    consumedIncoming.current = true; void consumeSelection(incoming.selectionId, incoming.fileName || 'MAP', routeStateContext(incoming));
    void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [consumeSelection, location.pathname, location.search, location.state, navigate]);
  const importBrowserFile = async (file?: File) => {
    if (!file) return; setError(''); setLookup(null);
    if (file.size > MAX_MAP_BYTES) { setError(`MAP 文件超过 ${formatSize(MAX_MAP_BYTES)} 上限`); return; }
    try { setSource(await file.text()); setFileName(file.name); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const importBaselineFile = async (file?: File) => {
    if (!file) return; setBaselineError('');
    if (file.size > MAX_MAP_BYTES) { setBaselineError(`基线 MAP 文件超过 ${formatSize(MAX_MAP_BYTES)} 上限`); return; }
    try { setBaselineSource(await file.text()); setBaselineFileName(file.name); setSelectedModule(''); } catch (reason) { setBaselineError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const clearBaseline = () => {
    activeBaselineAnalysis.current?.abort(); activeBaselineAnalysis.current = null;
    setBaselineSource(''); setBaselineFileName(''); setBaselineAnalysis(null); setBaselineError(''); setBaselineAnalyzing(false); setSelectedModule('');
  };
  const exportEvidence = (kind: 'json' | 'csv') => {
    if (!analysis || !baselineAnalysis || !comparison) return;
    const evidence = buildMapComparisonEvidence(analysis, baselineAnalysis, comparison, { currentFileName: fileName, baselineFileName });
    if (kind === 'json') { download(JSON.stringify(evidence, null, 2), 'application/json;charset=utf-8', 'map-comparison.json'); return; }
    const totals = Object.entries(comparison.totals).map(([name, delta]) => ['total', name, baselineAnalysis.totals[name as keyof MapAnalysis['totals']], analysis.totals[name as keyof MapAnalysis['totals']], delta]);
    const rows = [...totals, ...comparison.modules.map(item => ['module', item.name, item.before, item.after, item.delta]), ...comparison.symbols.map(item => ['symbol', item.name, item.before, item.after, item.delta])];
    download(`\uFEFF${[['Kind', 'Name', 'BaselineBytes', 'CurrentBytes', 'DeltaBytes'], ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')}`, 'text/csv;charset=utf-8', 'map-comparison.csv');
  };
  return <>
    <BuildAnalysisAssociation context={associationContext} revision={associationRevision} />
    {(fileName || progress !== null || analyzing) && <div className="mb-3 flex items-center gap-2 rounded border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-[11px] text-blue-300"><span className="min-w-0 flex-1 truncate">{fileName || 'MAP 内容'}{progress !== null && progress < 100 ? ` · 读取 ${progress}%` : analyzing ? ' · 后台分析中…' : execution === 'worker' ? ' · Web Worker 已完成' : execution === 'main-thread-fallback' ? ' · 兼容模式已完成' : ''}</span>{analyzing && <button onClick={() => activeAnalysis.current?.abort()} className="rounded border border-blue-400/30 px-2 py-1">取消</button>}</div>}
    {error && <div className="mb-3 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">{error}</div>}
    <label className="mb-3 block text-[11px] text-gray-500">MAP 内容<textarea value={source} onChange={event => { const next = event.target.value; setSource(next); setLookup(null); if (!next.trim()) { setAnalysis(null); setExecution(null); setAnalyzing(false); } }} rows={9} placeholder="粘贴 MAP 内容，或导入 .map 文件" className="field mt-1 resize-y font-mono" /></label>
    <label className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded border border-[#30363d] px-3 py-2 text-xs text-gray-400"><FileUp size={13} />导入 MAP 文件<input type="file" accept=".map,text/plain" className="hidden" onChange={event => void importBrowserFile(event.target.files?.[0])} /></label>
    {analysis && <>
      <div className="grid gap-2 sm:grid-cols-2"><Value label="格式" value={analysis.formatLabel} /><Value label="覆盖率 / 置信度" value={`${analysis.coverage.score}% / ${analysis.coverage.confidence}`} /><Value label="Flash" value={formatSize(analysis.totals.flash)} /><Value label="RAM" value={formatSize(analysis.totals.ram)} /><Value label="模块 / 符号" value={`${analysis.modules.length} / ${analysis.symbols.length}`} /><Value label="优化机会" value={analysis.optimizations.length} /></div>
      {analysis.warnings.length > 0 && <div className="mt-3 rounded border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-300">{analysis.warnings.join('；')}</div>}
      <section className="mt-3 rounded border border-[#30363d] bg-[#0d1117] p-3">
        <div className="flex flex-wrap items-center gap-2"><div className="min-w-0 flex-1"><h3 className="text-xs font-medium text-gray-200">版本对比证据</h3><p className="mt-1 text-[11px] text-gray-500">导入上一个可复现构建的 MAP，定位本次 Flash/RAM 增长来自哪个库、对象和符号。</p></div>{baselineSource && <button onClick={clearBaseline} className="inline-flex items-center gap-1 rounded border border-[#30363d] px-2 py-1 text-[11px] text-gray-500"><X size={11} />清除基线</button>}</div>
        <label className="mt-3 block text-[11px] text-gray-500">基线 MAP 内容<textarea aria-label="基线 MAP 内容" value={baselineSource} onChange={event => { setBaselineSource(event.target.value); setSelectedModule(''); if (!event.target.value.trim()) { setBaselineAnalysis(null); setBaselineError(''); } }} rows={5} placeholder="粘贴上一版本 MAP 内容，或导入基线 .map 文件" className="field mt-1 resize-y font-mono" /></label>
        <div className="mt-2 flex flex-wrap items-center gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded border border-[#30363d] px-3 py-2 text-xs text-gray-400"><FileUp size={13} />导入基线 MAP<input aria-label="导入基线 MAP" type="file" accept=".map,text/plain" className="hidden" onChange={event => void importBaselineFile(event.target.files?.[0])} /></label>{baselineFileName && <span className="max-w-72 truncate text-[11px] text-blue-300">{baselineFileName}</span>}{baselineAnalyzing && <><span className="text-[11px] text-blue-300">后台分析基线中…</span><button onClick={() => activeBaselineAnalysis.current?.abort()} className="rounded border border-blue-400/30 px-2 py-1 text-[11px] text-blue-300">取消</button></>}</div>
        {baselineError && <p role="alert" className="mt-2 rounded border border-red-500/20 bg-red-500/5 p-2 text-xs text-red-300">基线解析失败：{baselineError}。当前 MAP 分析不受影响。</p>}
        {comparison && baselineAnalysis && <div className="mt-3 border-t border-[#30363d] pt-3">
          <div className="flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-1 text-xs ${comparison.status === 'regressed' ? 'bg-red-500/10 text-red-300' : comparison.status === 'improved' ? 'bg-green-500/10 text-green-300' : comparison.status === 'insufficient' ? 'bg-yellow-500/10 text-yellow-300' : 'bg-blue-500/10 text-blue-300'}`}>{comparison.status === 'regressed' ? '容量增长' : comparison.status === 'improved' ? '容量下降' : comparison.status === 'mixed' ? 'Flash/RAM 一增一减' : comparison.status === 'unchanged' ? '总量未变化' : '证据不足'}</span><span className="text-[11px] text-gray-500">对比置信度：{comparison.confidence}{comparison.confidence !== 'high' && ' · 以下差异仅供排查，不判定为确定优化或退化'}</span><div className="ml-auto flex gap-2"><button onClick={() => exportEvidence('json')} className="inline-flex items-center gap-1 rounded border border-[#30363d] px-2 py-1 text-[11px] text-gray-400"><Download size={11} />JSON 证据</button><button onClick={() => exportEvidence('csv')} className="inline-flex items-center gap-1 rounded border border-[#30363d] px-2 py-1 text-[11px] text-gray-400"><Download size={11} />CSV</button></div></div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{(['flash', 'ram', 'code', 'roData', 'rwData', 'ziData'] as const).map(name => <Value key={name} label={name === 'roData' ? 'RO Data' : name === 'rwData' ? 'RW Data' : name === 'ziData' ? 'ZI / BSS' : name.toUpperCase()} value={signedSize(comparison.totals[name])} />)}</div>
          {comparison.warnings.length > 0 && <div className="mt-2 rounded border border-yellow-500/20 bg-yellow-500/5 p-2 text-[11px] text-yellow-300">{comparison.warnings.join('；')}</div>}
          <div className="mt-3 grid gap-3 xl:grid-cols-3"><DeltaTable title="增长模块（点击下钻）" rows={comparison.modules.filter(item => item.delta > 0)} onSelect={setSelectedModule} selected={selectedModule} /><DeltaTable title="减少模块（点击下钻）" rows={comparison.modules.filter(item => item.delta < 0)} onSelect={setSelectedModule} selected={selectedModule} /><DeltaTable title="符号差异" rows={comparison.symbols} /></div>
          {drilldown && <div className="mt-3 rounded border border-blue-500/20 bg-blue-500/5 p-3"><h4 className="text-xs text-blue-300">{drilldown.module} 贡献证据</h4><p className="mt-1 text-[10px] text-gray-500">先看 Code/RO/RW/ZI 口径，再用节区和符号确认具体对象；缺失明细表示该工具链 MAP 未输出对应表。</p><div className="mt-2 grid gap-3 lg:grid-cols-3"><DeltaTable title="内存分类" rows={drilldown.memory} /><DeltaTable title="节区明细" rows={drilldown.sections} /><DeltaTable title="符号明细" rows={drilldown.symbols} /></div></div>}
        </div>}
      </section>
      <section className="mt-3 rounded border border-[#30363d] bg-[#0d1117] p-3">
        <div className="flex flex-wrap items-end gap-2"><label className="min-w-[220px] flex-1 text-[10px] text-gray-500">固件地址<input value={address} onChange={event => setAddress(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') locate(); }} placeholder="例如 0x08001234" className="mt-1 w-full rounded border border-[#30363d] bg-[#080b0f] px-3 py-2 font-mono text-xs text-gray-200 outline-none focus:border-blue-500" /></label><button onClick={locate} disabled={!address.trim()} className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-2 text-xs text-white disabled:opacity-40"><Search size={13} />MAP 定位</button><Link to={`/toolbox/elf?address=${encodeURIComponent(address)}&source=map`} className={`rounded border border-[#30363d] px-3 py-2 text-xs ${address.trim() ? 'text-blue-300' : 'pointer-events-none text-gray-700'}`}>用 ELF 深度定位</Link></div>
        {lookupError && <p className="mt-2 text-xs text-red-300">{lookupError}</p>}
        {lookup && <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Value label="匹配 / 可信度" value={`${lookup.match} / ${lookup.confidence}`} /><Value label="规范化地址" value={`${hex(lookup.normalizedAddress)}${lookup.lowBitCleared ? '（已清除最低位）' : ''}`} /><Value label="符号 / 偏移" value={lookup.symbol ? `${lookup.symbol.name} + ${hex(lookup.symbol.offset)}` : '未匹配符号'} /><Value label="节区 / 偏移" value={lookup.section ? `${lookup.section.name} + ${hex(lookup.section.offset)}` : '未匹配节区'} /><p className="sm:col-span-2 lg:col-span-4 text-[11px] text-gray-500">{lookup.note}</p></div>}
      </section>
      <div className="mt-3 space-y-2">{analysis.insights.slice(0, 5).map(item => <div key={item.id} className="rounded border border-[#30363d] bg-[#0d1117] p-3"><b className="text-xs text-gray-200">{item.title}</b><p className="mt-1 text-[11px] text-gray-500">{item.detail}</p><p className="mt-1 text-[11px] text-blue-300">{item.recommendation}</p></div>)}</div>
    </>}
  </>;
}
