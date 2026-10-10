import { useMemo, useState } from 'react';
import { formatHex } from '../../utils/embeddedTools';
import { analyzeCanFrame } from './can';

function Value({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg bg-[#0d1117] px-3 py-2"><span className="block text-[10px] text-gray-600">{label}</span><code className="mt-1 block break-all text-xs text-gray-200">{value}</code></div>;
}

export default function CanTool() {
  const [id, setId] = useState('123');
  const [extended, setExtended] = useState(false);
  const [data, setData] = useState('DE AD BE EF');
  const [bitRate, setBitRate] = useState('500000');
  const result = useMemo(() => {
    try {
      return { value: analyzeCanFrame(id, extended, data, Number(bitRate)), error: '' };
    } catch (reason) {
      return { value: null, error: reason instanceof Error ? reason.message : String(reason) };
    }
  }, [bitRate, data, extended, id]);

  return <><div className="mb-3 grid gap-2 sm:grid-cols-2"><label className="text-[11px] text-gray-500">CAN ID（HEX）<input value={id} onChange={event => setId(event.target.value)} className="field mt-1" /></label><label className="text-[11px] text-gray-500">波特率 bit/s<input type="number" value={bitRate} onChange={event => setBitRate(event.target.value)} className="field mt-1" /></label></div><label className="mb-3 flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={extended} onChange={event => setExtended(event.target.checked)} />29 位扩展帧</label><label className="mb-3 block text-[11px] text-gray-500">数据字节（最多 8 字节）<textarea value={data} onChange={event => setData(event.target.value)} rows={3} className="field mt-1 resize-none font-mono" /></label>{result.error && <p className="mb-3 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">{result.error}</p>}{result.value && <div className="grid gap-2 sm:grid-cols-2"><Value label="规范 ID" value={result.value.idHex} /><Value label="DLC" value={result.value.dlc} /><Value label="数据" value={formatHex(result.value.data) || '无'} /><Value label="基础帧长度" value={`${result.value.baseBits} bit`} /><Value label="最坏填充长度" value={`${result.value.worstCaseBits} bit`} /><Value label="理论发送时间" value={`${result.value.durationUs.toFixed(2)}–${result.value.worstDurationUs.toFixed(2)} µs`} /></div>}</>;
}
