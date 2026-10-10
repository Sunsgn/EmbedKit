import { useMemo, useState } from 'react';
import { FileUp } from 'lucide-react';
import { analyzeMap } from '../../utils/mapAnalyzer';

function Value({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg bg-[#0d1117] px-3 py-2"><span className="block text-[10px] text-gray-600">{label}</span><code className="mt-1 block break-all text-xs text-gray-200">{value}</code></div>;
}

const formatSize = (value: number) => value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(2)} MiB` : value >= 1024 ? `${(value / 1024).toFixed(2)} KiB` : `${value} B`;

export function MapQuickTool() {
  const [source, setSource] = useState('');
  const analysis = useMemo(() => source.trim() ? analyzeMap(source) : null, [source]);
  return <><label className="mb-3 block text-[11px] text-gray-500">MAP 内容<textarea value={source} onChange={event => setSource(event.target.value)} rows={9} placeholder="粘贴 MAP 内容，或导入 .map 文件" className="field mt-1 resize-y font-mono" /></label><label className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded border border-[#30363d] px-3 py-2 text-xs text-gray-400"><FileUp size={13} />导入 MAP 文件<input type="file" accept=".map,text/plain" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void file.text().then(setSource); }} /></label>{analysis && <><div className="grid gap-2 sm:grid-cols-2"><Value label="格式" value={analysis.formatLabel} /><Value label="覆盖率 / 置信度" value={`${analysis.coverage.score}% / ${analysis.coverage.confidence}`} /><Value label="Flash" value={formatSize(analysis.totals.flash)} /><Value label="RAM" value={formatSize(analysis.totals.ram)} /><Value label="模块 / 符号" value={`${analysis.modules.length} / ${analysis.symbols.length}`} /><Value label="优化机会" value={analysis.optimizations.length} /></div>{analysis.warnings.length > 0 && <div className="mt-3 rounded border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-300">{analysis.warnings.join('；')}</div>}<div className="mt-3 space-y-2">{analysis.insights.slice(0, 5).map(item => <div key={item.id} className="rounded border border-[#30363d] bg-[#0d1117] p-3"><b className="text-xs text-gray-200">{item.title}</b><p className="mt-1 text-[11px] text-gray-500">{item.detail}</p><p className="mt-1 text-[11px] text-blue-300">{item.recommendation}</p></div>)}</div></>}</>;
}
