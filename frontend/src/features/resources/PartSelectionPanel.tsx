import { useMemo, useState } from 'react';
import { Download, ExternalLink, Filter, ShieldAlert } from 'lucide-react';
import { communicationSelectionCatalog } from './communicationSelectionCatalog';
import { rankPartSelections, type SelectionCriterion } from './selectionEngine';
import OnlinePartLookup from './OnlinePartLookup';
import type { PartRecord } from '../../types';
import SelectionRecordManager from './SelectionRecordManager';
import type { PartSelectionRecord } from './selectionRecords';

const outcomeStyle = {
  eligible: { label: '满足且已核验', className: 'border-green-500/30 bg-green-500/10 text-green-300' },
  'needs-verification': { label: '候选，需核验', className: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300' },
  excluded: { label: '已排除', className: 'border-red-500/30 bg-red-500/10 text-red-300' },
};

export default function PartSelectionPanel() {
  const [standard, setStandard] = useState('CAN FD');
  const [minimumRate, setMinimumRate] = useState('2');
  const [temperatureEnabled, setTemperatureEnabled] = useState(false);
  const [temperatureMin, setTemperatureMin] = useState('-40');
  const [temperatureMax, setTemperatureMax] = useState('85');
  const [onlineParts, setOnlineParts] = useState<PartRecord[]>([]);
  const [restoredParts, setRestoredParts] = useState<PartRecord[] | null>(null);
  const catalog = useMemo(() => restoredParts ?? [...communicationSelectionCatalog, ...onlineParts], [onlineParts, restoredParts]);
  const criteria = useMemo<SelectionCriterion[]>(() => {
    const result: SelectionCriterion[] = [
      { id: 'standard', key: 'bus-standard', label: '总线标准', required: true, operator: 'equals', value: standard },
      { id: 'rate', key: 'data-rate-mbps', label: '最低数据速率', required: true, operator: 'at-least', value: Math.max(0, Number(minimumRate) || 0), unit: 'Mbps' },
    ];
    if (temperatureEnabled) result.push({ id: 'temperature', key: 'temperature-c', label: '工作温度范围', required: true, operator: 'contains-range', min: Number(temperatureMin) || 0, max: Number(temperatureMax) || 0, unit: '°C' });
    return result;
  }, [minimumRate, standard, temperatureEnabled, temperatureMax, temperatureMin]);
  const results = useMemo(() => rankPartSelections(catalog, criteria), [catalog, criteria]);
  const restoreRecord = (record: PartSelectionRecord) => {
    const standardCriterion = record.criteria.find((item): item is Extract<SelectionCriterion, { operator: 'equals' }> => item.id === 'standard' && item.operator === 'equals');
    const rateCriterion = record.criteria.find((item): item is Extract<SelectionCriterion, { operator: 'at-least' }> => item.id === 'rate' && item.operator === 'at-least');
    const temperatureCriterion = record.criteria.find((item): item is Extract<SelectionCriterion, { operator: 'contains-range' }> => item.id === 'temperature' && item.operator === 'contains-range');
    if (standardCriterion && typeof standardCriterion.value === 'string') setStandard(standardCriterion.value);
    if (rateCriterion) setMinimumRate(String(rateCriterion.value));
    setTemperatureEnabled(Boolean(temperatureCriterion));
    if (temperatureCriterion) { setTemperatureMin(String(temperatureCriterion.min)); setTemperatureMax(String(temperatureCriterion.max)); }
    setOnlineParts([]); setRestoredParts(record.parts);
  };

  const exportReport = () => {
    const payload = { schemaVersion: 1, kind: 'embedkit-part-selection', generatedAt: new Date().toISOString(), scope: 'communication-transceiver', criteria, candidates: results.map(result => ({ ...result, part: catalog.find(item => item.id === result.partId) })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `embedkit-selection-${Date.now()}.json`; anchor.click(); URL.revokeObjectURL(url);
  };

  return <section className="mb-5 overflow-hidden rounded-xl border border-blue-500/25 bg-[#161b22]">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#30363d] p-4"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-blue-300"><Filter size={16} />按功能选型 · 通信收发器</h2><p className="mt-1 text-[11px] text-gray-500">使用硬条件筛选真实目录器件；缺失和未核验参数不会显示为确定满足。</p></div><button onClick={exportReport} className="flex items-center gap-1.5 rounded border border-[#30363d] px-3 py-1.5 text-xs text-gray-300 hover:border-blue-500/40"><Download size={13} />导出证据 JSON</button></div>
    <SelectionRecordManager name={`${standard} · ≥${minimumRate || 0} Mbps`} criteria={criteria} parts={catalog} evaluations={results} onRestore={restoreRecord} />
    <div className="grid gap-4 p-4 xl:grid-cols-[310px_minmax(0,1fr)]">
      <div><div className="space-y-3 rounded-lg border border-[#30363d] bg-[#0d1117] p-3"><label className="block text-[11px] text-gray-500">总线标准<select value={standard} onChange={event => setStandard(event.target.value)} className="field mt-1"><option>CAN FD</option><option>CAN</option><option>RS-485</option><option>RS-422</option></select></label><label className="block text-[11px] text-gray-500">最低数据速率（Mbps）<input type="number" min="0" step="0.1" value={minimumRate} onChange={event => setMinimumRate(event.target.value)} className="field mt-1" /></label><label className="flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={temperatureEnabled} onChange={event => setTemperatureEnabled(event.target.checked)} />工作温度作为硬条件</label>{temperatureEnabled && <div className="grid grid-cols-2 gap-2"><label className="text-[10px] text-gray-600">最低 ℃<input type="number" value={temperatureMin} onChange={event => setTemperatureMin(event.target.value)} className="field mt-1" /></label><label className="text-[10px] text-gray-600">最高 ℃<input type="number" value={temperatureMax} onChange={event => setTemperatureMax(event.target.value)} className="field mt-1" /></label></div>}<div className="flex gap-2 rounded border border-yellow-500/15 bg-yellow-500/5 p-2 text-[10px] leading-4 text-yellow-200"><ShieldAlert size={13} className="mt-0.5 shrink-0" />当前基础目录参数属于已导入数据。进入正式 BOM 前，需要按完整订货后缀核对官方手册。</div></div><OnlinePartLookup onAdd={part => { setRestoredParts(current => current ? [...current.filter(item => item.id !== part.id), part] : current); setOnlineParts(current => [...current.filter(item => item.id !== part.id), part]); }} /></div>
      <div className="space-y-3">{results.map(result => { const part = catalog.find(item => item.id === result.partId)!; const style = outcomeStyle[result.outcome]; return <article key={result.partId} className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><b className="text-sm text-gray-200">{part.mpn}</b><p className="text-[10px] text-gray-600">{part.manufacturer} · {part.subcategory}</p></div><span className={`rounded border px-2 py-1 text-[10px] ${style.className}`}>{style.label}</span></div><div className="mt-3 grid gap-1.5 sm:grid-cols-2">{result.evaluations.map(item => <div key={item.criterionId} className={`rounded px-2 py-1.5 text-[10px] ${item.outcome === 'match' ? 'bg-green-500/5 text-green-300' : item.outcome === 'mismatch' ? 'bg-red-500/5 text-red-300' : 'bg-yellow-500/5 text-yellow-300'}`}><b>{item.label}</b><span className="ml-1">{item.message}</span></div>)}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#20262e] pt-2 text-[10px] text-gray-600"><span>满足 {result.matched} · 未知 {result.unknown} · 不满足 {result.mismatched}</span><div className="flex gap-2">{part.documents.map(document => document.url && <a key={document.id} href={document.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400"><ExternalLink size={10} />{document.title}</a>)}</div></div></article>; })}</div>
    </div>
  </section>;
}
