import { useMemo, useState } from 'react';
import { FileUp } from 'lucide-react';
import { analyzeBinary, formatHex } from '../../utils/embeddedTools';
import { analyzeMap } from '../../utils/mapAnalyzer';

function Value({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg bg-[#0d1117] px-3 py-2"><span className="block text-[10px] text-gray-600">{label}</span><code className="mt-1 block break-all text-xs text-gray-200">{value}</code></div>;
}

const formatSize = (value: number) => value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(2)} MiB` : value >= 1024 ? `${(value / 1024).toFixed(2)} KiB` : `${value} B`;

export function BinaryTool() {
  const [bytes, setBytes] = useState<Uint8Array | null>(null), [name, setName] = useState('');
  const result = bytes ? analyzeBinary(bytes) : null;
  return <><label className="mb-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#30363d] bg-[#0d1117] text-sm text-gray-500 hover:border-blue-500/40"><FileUp size={22} className="mb-2" />{name || '选择 BIN 文件，本地读取且不上传'}<input type="file" accept=".bin,application/octet-stream" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void file.arrayBuffer().then(buffer => { setName(file.name); setBytes(new Uint8Array(buffer)); }); }} /></label>{result ? <div className="grid gap-2 sm:grid-cols-2"><Value label="文件大小" value={formatSize(result.size)} /><Value label="CRC32" value={`0x${result.crc32.toString(16).padStart(8, '0').toUpperCase()}`} /><Value label="00 字节" value={`${result.zeroBytes} (${(result.zeroBytes / Math.max(1, result.size) * 100).toFixed(2)}%)`} /><Value label="FF 字节" value={`${result.erasedBytes} (${(result.erasedBytes / Math.max(1, result.size) * 100).toFixed(2)}%)`} /><Value label="头部 32 字节" value={formatHex(result.head) || '空'} /><Value label="尾部 16 字节" value={formatHex(result.tail) || '空'} /></div> : <p className="text-xs text-gray-600">导入后显示大小、CRC32、空白比例和头尾 HEX 预览。</p>}</>;
}

export function MapQuickTool() {
  const [source, setSource] = useState('');
  const analysis = useMemo(() => source.trim() ? analyzeMap(source) : null, [source]);
  return <><label className="mb-3 block text-[11px] text-gray-500">MAP 内容<textarea value={source} onChange={event => setSource(event.target.value)} rows={9} placeholder="粘贴 MAP 内容，或导入 .map 文件" className="field mt-1 resize-y font-mono" /></label><label className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded border border-[#30363d] px-3 py-2 text-xs text-gray-400"><FileUp size={13} />导入 MAP 文件<input type="file" accept=".map,text/plain" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void file.text().then(setSource); }} /></label>{analysis && <><div className="grid gap-2 sm:grid-cols-2"><Value label="格式" value={analysis.formatLabel} /><Value label="覆盖率 / 置信度" value={`${analysis.coverage.score}% / ${analysis.coverage.confidence}`} /><Value label="Flash" value={formatSize(analysis.totals.flash)} /><Value label="RAM" value={formatSize(analysis.totals.ram)} /><Value label="模块 / 符号" value={`${analysis.modules.length} / ${analysis.symbols.length}`} /><Value label="优化机会" value={analysis.optimizations.length} /></div>{analysis.warnings.length > 0 && <div className="mt-3 rounded border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-300">{analysis.warnings.join('；')}</div>}<div className="mt-3 space-y-2">{analysis.insights.slice(0, 5).map(item => <div key={item.id} className="rounded border border-[#30363d] bg-[#0d1117] p-3"><b className="text-xs text-gray-200">{item.title}</b><p className="mt-1 text-[11px] text-gray-500">{item.detail}</p><p className="mt-1 text-[11px] text-blue-300">{item.recommendation}</p></div>)}</div></>}</>;
}
