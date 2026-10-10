import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileSearch, Search } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { analyzeSelectedElf, lookupElfAddress, type ElfAddressLookup, type ElfAnalysis } from '../../services/elfAgent';
import { revokeLocalPath, selectLocalFile } from '../../services/localFiles';

const size = (value: number) => value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(2)} MiB` : value >= 1024 ? `${(value / 1024).toFixed(2)} KiB` : `${value} B`;
function Value({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg bg-[#0d1117] px-3 py-2"><span className="block text-[10px] text-gray-600">{label}</span><code className="mt-1 block break-all text-xs text-gray-200">{value}</code></div>; }

export default function ElfTool() {
  const [searchParams] = useSearchParams();
  const location = useLocation(), navigate = useNavigate(), consumedIncoming = useRef(false);
  const [analysis, setAnalysis] = useState<ElfAnalysis | null>(null);
  const [fileName, setFileName] = useState('');
  const [address, setAddress] = useState(() => searchParams.get('address') || '');
  const [lookup, setLookup] = useState<ElfAddressLookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [error, setError] = useState('');
  const [lookupError, setLookupError] = useState('');

  const consumeSelection = useCallback(async (selectionId: string, name: string) => {
    setBusy(true); setError(''); setLookup(null); setLookupError('');
    try {
      setFileName(name || 'ELF');
      try { const result = await analyzeSelectedElf(selectionId); setAnalysis(result); setAddress(current => current || result.entry); }
      finally { await revokeLocalPath(selectionId).catch(() => undefined); }
    } catch (reason) { setAnalysis(null); setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }, []);
  const select = async () => { setBusy(true); setError(''); try { const selected = await selectLocalFile(); if (!selected.cancelled && selected.selectionId) await consumeSelection(selected.selectionId, selected.name || 'ELF'); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); } };
  useEffect(() => {
    const incoming = location.state as { selectionId?: string; fileName?: string; source?: string } | null;
    if (consumedIncoming.current || !incoming?.selectionId || incoming.source !== 'build-artifact') return;
    consumedIncoming.current = true; void consumeSelection(incoming.selectionId, incoming.fileName || 'ELF');
    void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [consumeSelection, location.pathname, location.search, location.state, navigate]);
  const locate = async () => {
    if (!analysis || !address.trim()) return;
    setLookupBusy(true); setLookupError('');
    try { setLookup(await lookupElfAddress(analysis.analysisId, address)); }
    catch (reason) { setLookup(null); setLookupError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLookupBusy(false); }
  };
  const download = () => {
    if (!analysis) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify({ fileName, analyzedAt: new Date().toISOString(), ...analysis }, null, 2)], { type: 'application/json' }));
    link.download = `${fileName || 'elf'}-analysis.json`; link.click(); URL.revokeObjectURL(link.href);
  };

  return <>
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <button onClick={() => void select()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs text-white disabled:opacity-40"><FileSearch size={14} />{busy ? '正在分析…' : '选择 ELF / AXF / OUT'}</button>
      <span className="min-w-0 flex-1 truncate text-xs text-gray-500">{fileName || '通过 Local Agent 系统选择器读取，不要求重新编译'}</span>
      <button onClick={download} disabled={!analysis} className="inline-flex items-center gap-1 rounded border border-[#30363d] px-3 py-2 text-xs text-gray-400 disabled:opacity-30"><Download size={13} />导出 JSON</button>
    </div>
    {error && <div className="mb-3 rounded border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">{error}</div>}
    {analysis && <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Value label="格式" value={`${analysis.bits}-bit ${analysis.byteOrder}-endian`} /><Value label="目标架构" value={`${analysis.machine} (${analysis.machineId})`} />
        <Value label="文件类型 / 入口" value={`${analysis.type} / ${analysis.entry}`} /><Value label="文件大小" value={size(analysis.fileSize)} />
        <Value label="程序段 / 节区" value={`${analysis.segments.length} / ${analysis.sections.length}`} /><Value label="符号" value={analysis.hasSymbols ? `${analysis.namedSymbolCount} 个命名 / ${analysis.symbolCount} 个总计` : '未发现'} />
        <Value label="DWARF" value={analysis.hasDwarf ? `${analysis.dwarfSections.join(', ')}${analysis.dwarfVersions.length ? ` / v${analysis.dwarfVersions.join(', v')}` : ''}` : '未发现'} /><Value label="源码定位能力" value={analysis.hasSourceLines ? `${analysis.dwarfLineCount} 条源码行` : analysis.hasSymbols ? '函数/对象级' : '仅地址/节区级'} />
      </div>
      {analysis.warnings.length > 0 && <div className="mt-3 rounded border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-300">{analysis.warnings.join('；')}</div>}

      <section className="mt-3 rounded border border-[#30363d] bg-[#0d1117] p-3">
        <div className="mb-2 flex flex-wrap items-end gap-2">
          <label className="min-w-[220px] flex-1 text-[10px] text-gray-500">PC / LR / 任意地址
            <input value={address} onChange={event => setAddress(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void locate(); }} placeholder="例如 0x08000108" className="mt-1 w-full rounded border border-[#30363d] bg-[#080b0f] px-3 py-2 font-mono text-xs text-gray-200 outline-none focus:border-blue-500" />
          </label>
          <button onClick={() => void locate()} disabled={lookupBusy || !address.trim()} className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-2 text-xs text-white disabled:opacity-40"><Search size={13} />{lookupBusy ? '定位中…' : '定位地址'}</button>
        </div>
        {lookupError && <div className="text-xs text-red-300">{lookupError}</div>}
        {lookup && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Value label="匹配级别 / 可信度" value={`${lookup.match} / ${lookup.confidence}`} />
          <Value label="规范化地址" value={`${lookup.normalizedAddress}${lookup.thumbBitCleared ? '（已清除 Thumb 位）' : ''}`} />
          <Value label="符号 / 偏移" value={lookup.symbol ? `${lookup.symbol.name} + ${lookup.symbol.offset}` : '未匹配符号'} />
          <Value label="节区 / 偏移" value={lookup.section ? `${lookup.section.name} + ${lookup.section.offset}` : '未匹配节区'} />
          <Value label="源码位置" value={lookup.source ? `${lookup.source.file}:${lookup.source.line}${lookup.source.column ? `:${lookup.source.column}` : ''}` : '没有匹配的受支持行表'} />
          <p className="sm:col-span-2 lg:col-span-3 text-[11px] text-gray-500">{lookup.note}</p>
        </div>}
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className="overflow-hidden rounded border border-[#30363d]"><h3 className="bg-[#111820] px-3 py-2 text-xs font-semibold">程序段</h3><div className="max-h-64 overflow-auto"><table className="w-full text-left text-[10px]"><thead className="text-gray-600"><tr><th className="p-2">类型</th><th>虚拟地址</th><th>文件 / 内存</th></tr></thead><tbody>{analysis.segments.map(item => <tr key={item.index} className="border-t border-[#20262d]"><td className="p-2 text-blue-300">{item.type}</td><td className="font-mono">{item.virtualAddress}</td><td>{size(item.fileSize)} / {size(item.memorySize)}</td></tr>)}</tbody></table></div></section>
        <section className="overflow-hidden rounded border border-[#30363d]"><h3 className="bg-[#111820] px-3 py-2 text-xs font-semibold">节区</h3><div className="max-h-64 overflow-auto"><table className="w-full text-left text-[10px]"><thead className="text-gray-600"><tr><th className="p-2">名称</th><th>类型</th><th>地址</th><th>大小</th></tr></thead><tbody>{analysis.sections.filter(item => item.name).map(item => <tr key={item.index} className="border-t border-[#20262d]"><td className="p-2 font-mono text-green-300">{item.name}</td><td>{item.type}</td><td className="font-mono">{item.address}</td><td>{size(item.size)}</td></tr>)}</tbody></table></div></section>
      </div>
      {analysis.symbolPreview.length > 0 && <section className="mt-3 overflow-hidden rounded border border-[#30363d]"><h3 className="bg-[#111820] px-3 py-2 text-xs font-semibold">符号预览（前 {analysis.symbolPreview.length} 个函数/对象）</h3><div className="max-h-64 overflow-auto"><table className="w-full text-left text-[10px]"><thead className="text-gray-600"><tr><th className="p-2">名称</th><th>类型 / 绑定</th><th>地址</th><th>大小</th><th>节区</th></tr></thead><tbody>{analysis.symbolPreview.map(item => <tr key={`${item.table}-${item.index}`} className="border-t border-[#20262d]"><td className="p-2 font-mono text-green-300">{item.name}</td><td>{item.type} / {item.binding}</td><td className="font-mono">{item.normalizedAddress}</td><td>{size(item.size)}</td><td>{item.sectionName}</td></tr>)}</tbody></table></div></section>}
    </>}
  </>;
}
