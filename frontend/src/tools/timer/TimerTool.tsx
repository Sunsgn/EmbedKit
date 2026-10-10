import { useMemo, useState } from 'react';
import { calculateTimerPwm } from './timer';

function Value({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-[#0d1117] px-3 py-2"><span className="block text-[10px] text-gray-600">{label}</span><code className="mt-1 block break-all text-xs text-gray-200">{value}</code></div>;
}

export default function TimerTool() {
  const [clock, setClock] = useState('72000000');
  const [psc, setPsc] = useState('71');
  const [arr, setArr] = useState('999');
  const [ccr, setCcr] = useState('500');
  const result = useMemo(() => {
    try {
      return { value: calculateTimerPwm(Number(clock), Number(psc), Number(arr), Number(ccr)), error: '' };
    } catch (reason) {
      return { value: null, error: reason instanceof Error ? reason.message : String(reason) };
    }
  }, [arr, ccr, clock, psc]);

  return <><div className="mb-3 grid grid-cols-2 gap-2"><label className="text-[11px] text-gray-500">定时器时钟 Hz<input type="number" value={clock} onChange={event => setClock(event.target.value)} className="field mt-1" /></label><label className="text-[11px] text-gray-500">PSC<input type="number" value={psc} onChange={event => setPsc(event.target.value)} className="field mt-1" /></label><label className="text-[11px] text-gray-500">ARR<input type="number" value={arr} onChange={event => setArr(event.target.value)} className="field mt-1" /></label><label className="text-[11px] text-gray-500">CCR<input type="number" value={ccr} onChange={event => setCcr(event.target.value)} className="field mt-1" /></label></div>{result.error && <p className="mb-3 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">{result.error}</p>}{result.value && <div className="grid gap-2 sm:grid-cols-2"><Value label="计数时钟" value={`${result.value.counterClockHz.toFixed(3)} Hz`} /><Value label="PWM 频率" value={`${result.value.frequencyHz.toFixed(6)} Hz`} /><Value label="周期" value={`${result.value.periodUs.toFixed(3)} µs`} /><Value label="占空比" value={`${result.value.dutyPercent.toFixed(3)} %`} /><Value label="计数分辨率" value={`${result.value.resolutionNs.toFixed(3)} ns`} /></div>}</>;
}
