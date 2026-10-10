import { useMemo, useState } from 'react';
import { FileUp, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { analyzeMap } from './map';
import { lookupMapAddress, type MapAddressLookup } from '../../utils/mapAnalyzer';

const formatSize = (value: number) => value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(2)} MiB` : value >= 1024 ? `${(value / 1024).toFixed(2)} KiB` : `${value} B`;
const hex = (value: number) => `0x${value.toString(16).toUpperCase()}`;
function Value({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg bg-[#0d1117] px-3 py-2"><span className="block text-[10px] text-gray-600">{label}</span><code className="mt-1 block break-all text-xs text-gray-200">{value}</code></div>; }

export default function MapTool() {
  const [source, setSource] = useState(''), [address, setAddress] = useState(''), [lookup, setLookup] = useState<MapAddressLookup | null>(null), [lookupError, setLookupError] = useState('');
  const analysis = useMemo(() => source.trim() ? analyzeMap(source) : null, [source]);
  const locate = () => { if (!analysis) return; try { setLookup(lookupMapAddress(analysis, address)); setLookupError(''); } catch (error) { setLookup(null); setLookupError(error instanceof Error ? error.message : String(error)); } };
  return <>
    <label className="mb-3 block text-[11px] text-gray-500">MAP 内容<textarea value={source} onChange={event => { setSource(event.target.value); setLookup(null); }} rows={9} placeholder="粘贴 MAP 内容，或导入 .map 文件" className="field mt-1 resize-y font-mono" /></label>
    <label className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded border border-[#30363d] px-3 py-2 text-xs text-gray-400"><FileUp size={13} />导入 MAP 文件<input type="file" accept=".map,text/plain" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void file.text().then(value => { setSource(value); setLookup(null); }); }} /></label>
    {analysis && <>
      <div className="grid gap-2 sm:grid-cols-2"><Value label="格式" value={analysis.formatLabel} /><Value label="覆盖率 / 置信度" value={`${analysis.coverage.score}% / ${analysis.coverage.confidence}`} /><Value label="Flash" value={formatSize(analysis.totals.flash)} /><Value label="RAM" value={formatSize(analysis.totals.ram)} /><Value label="模块 / 符号" value={`${analysis.modules.length} / ${analysis.symbols.length}`} /><Value label="优化机会" value={analysis.optimizations.length} /></div>
      {analysis.warnings.length > 0 && <div className="mt-3 rounded border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-300">{analysis.warnings.join('；')}</div>}
      <section className="mt-3 rounded border border-[#30363d] bg-[#0d1117] p-3">
        <div className="flex flex-wrap items-end gap-2"><label className="min-w-[220px] flex-1 text-[10px] text-gray-500">固件地址<input value={address} onChange={event => setAddress(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') locate(); }} placeholder="例如 0x08001234" className="mt-1 w-full rounded border border-[#30363d] bg-[#080b0f] px-3 py-2 font-mono text-xs text-gray-200 outline-none focus:border-blue-500" /></label><button onClick={locate} disabled={!address.trim()} className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-2 text-xs text-white disabled:opacity-40"><Search size={13} />MAP 定位</button><Link to={`/toolbox/elf?address=${encodeURIComponent(address)}&source=map`} className={`rounded border border-[#30363d] px-3 py-2 text-xs ${address.trim() ? 'text-blue-300' : 'pointer-events-none text-gray-700'}`}>用 ELF 深度定位</Link></div>
        {lookupError && <p className="mt-2 text-xs text-red-300">{lookupError}</p>}
        {lookup && <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Value label="匹配 / 可信度" value={`${lookup.match} / ${lookup.confidence}`} /><Value label="规范化地址" value={`${hex(lookup.normalizedAddress)}${lookup.lowBitCleared ? '（已清除最低位）' : ''}`} /><Value label="符号 / 偏移" value={lookup.symbol ? `${lookup.symbol.name} + ${hex(lookup.symbol.offset)}` : '未匹配符号'} /><Value label="节区 / 偏移" value={lookup.section ? `${lookup.section.name} + ${hex(lookup.section.offset)}` : '未匹配节区'} /><p className="sm:col-span-2 lg:col-span-4 text-[11px] text-gray-500">{lookup.note}</p></div>}
      </section>
      <div className="mt-3 space-y-2">{analysis.insights.slice(0, 5).map(item => <div key={item.id} className="rounded border border-[#30363d] bg-[#0d1117] p-3"><b className="text-xs text-gray-200">{item.title}</b><p className="mt-1 text-[11px] text-gray-500">{item.detail}</p><p className="mt-1 text-[11px] text-blue-300">{item.recommendation}</p></div>)}</div>
    </>}
  </>;
}
