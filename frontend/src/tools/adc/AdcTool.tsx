import { useMemo, useState } from 'react';
import { calculateAdc } from './adc';

function Value({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg bg-[#0d1117] px-3 py-2"><span className="block text-[10px] text-gray-600">{label}</span><code className="mt-1 block break-all text-xs text-gray-200">{value}</code></div>;
}

export default function AdcTool() {
  const [bits, setBits] = useState('12');
  const [reference, setReference] = useState('3.3');
  const [raw, setRaw] = useState('2048');
  const [top, setTop] = useState('10000');
  const [bottom, setBottom] = useState('10000');
  const result = useMemo(() => {
    try {
      return { value: calculateAdc(Number(bits), Number(reference), Number(raw), Number(top), Number(bottom)), error: '' };
    } catch (reason) {
      return { value: null, error: reason instanceof Error ? reason.message : String(reason) };
    }
  }, [bits, bottom, raw, reference, top]);

  return <><div className="mb-3 grid grid-cols-2 gap-2"><label className="text-[11px] text-gray-500">ADC 位数<input type="number" value={bits} onChange={event => setBits(event.target.value)} className="field mt-1" /></label><label className="text-[11px] text-gray-500">参考电压 V<input type="number" step="any" value={reference} onChange={event => setReference(event.target.value)} className="field mt-1" /></label><label className="text-[11px] text-gray-500">原始值<input type="number" value={raw} onChange={event => setRaw(event.target.value)} className="field mt-1" /></label><span /><label className="text-[11px] text-gray-500">上拉电阻 Ω<input type="number" value={top} onChange={event => setTop(event.target.value)} className="field mt-1" /></label><label className="text-[11px] text-gray-500">下拉电阻 Ω<input type="number" value={bottom} onChange={event => setBottom(event.target.value)} className="field mt-1" /></label></div>{result.error && <p className="mb-3 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">{result.error}</p>}{result.value && <div className="grid gap-2 sm:grid-cols-2"><Value label="满量程码" value={result.value.maxCode} /><Value label="LSB" value={`${(result.value.lsbVoltage * 1000).toFixed(6)} mV`} /><Value label="ADC 引脚电压" value={`${result.value.pinVoltage.toFixed(6)} V`} /><Value label="分压前电压" value={`${result.value.sourceVoltage.toFixed(6)} V`} /><Value label="量程比例" value={`${result.value.percent.toFixed(3)} %`} /></div>}</>;
}
