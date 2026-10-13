import { useMemo, useState } from 'react';
import ToolResultRow from '../../features/toolbox/ToolResultRow';
import { calculateCrcBatch, calculateCrcRange, calculateCrcSummary, CRC_PRESETS, generateCrcC, parseCrcParameter, type CrcInputMode, type CrcParameters } from './crc';

const parameterHex = (value: number) => `0x${value.toString(16).toUpperCase()}`;

export default function CrcTool() {
  const [value, setValue] = useState('01 03 00 00 00 02');
  const [mode, setMode] = useState<CrcInputMode>('hex');
  const [preset, setPreset] = useState('crc16-modbus');
  const [batch, setBatch] = useState(false), [start, setStart] = useState('0'), [end, setEnd] = useState('');
  const [width, setWidth] = useState('16'), [polynomial, setPolynomial] = useState('0x8005'), [initial, setInitial] = useState('0xFFFF'), [xorOutput, setXorOutput] = useState('0x0000');
  const [reflectInput, setReflectInput] = useState(true), [reflectOutput, setReflectOutput] = useState(true);
  const legacy = useMemo(() => { try { return { value: calculateCrcSummary(value, mode), error: '' }; } catch (error) { return { value: null, error: error instanceof Error ? error.message : String(error) }; } }, [mode, value]);
  const model = useMemo(() => {
    try {
      if (preset !== 'custom') return { value: CRC_PRESETS[preset], error: '' };
      const value: CrcParameters = { name: '自定义 CRC', width: Number(width), polynomial: parseCrcParameter(polynomial, '多项式'), initial: parseCrcParameter(initial, '初始值'), reflectInput, reflectOutput, xorOutput: parseCrcParameter(xorOutput, '结果异或值') };
      return { value, error: '' };
    } catch (error) { return { value: null, error: error instanceof Error ? error.message : String(error) }; }
  }, [initial, polynomial, preset, reflectInput, reflectOutput, width, xorOutput]);
  const calculated = useMemo(() => {
    if (!model.value) return { single: null, rows: [], error: model.error };
    try {
      if (batch) return { single: null, rows: calculateCrcBatch(value, mode, model.value), error: '' };
      return { single: calculateCrcRange(value, mode, model.value, Number(start), end.trim() ? Number(end) : undefined), rows: [], error: '' };
    } catch (error) { return { single: null, rows: [], error: error instanceof Error ? error.message : String(error) }; }
  }, [batch, end, mode, model, start, value]);
  const code = useMemo(() => model.value ? generateCrcC(model.value) : '', [model]);
  const selectPreset = (id: string) => {
    setPreset(id); const selected = CRC_PRESETS[id];
    if (selected) { setWidth(String(selected.width)); setPolynomial(parameterHex(selected.polynomial)); setInitial(parameterHex(selected.initial)); setXorOutput(parameterHex(selected.xorOutput)); setReflectInput(selected.reflectInput); setReflectOutput(selected.reflectOutput); }
  };

  return <div className="space-y-5">
    <section><div className="mb-2 flex flex-wrap items-center gap-2 text-xs">{(['hex', 'text'] as const).map(item => <button key={item} onClick={() => setMode(item)} className={`rounded-md px-2.5 py-1 ${mode === item ? 'bg-blue-500/20 text-blue-300' : 'bg-[#0d1117] text-gray-500'}`}>{item === 'hex' ? 'HEX 字节' : 'UTF-8 文本'}</button>)}<label className="ml-auto flex items-center gap-1 text-gray-500"><input type="checkbox" checked={batch} onChange={event => setBatch(event.target.checked)} />每行一帧批量计算</label></div><textarea aria-label="CRC 输入" value={value} onChange={event => setValue(event.target.value)} rows={batch ? 6 : 3} className="mb-3 w-full resize-y rounded-lg border border-[#30363d] bg-[#0d1117] p-3 font-mono text-sm outline-none focus:border-blue-500" placeholder={batch ? '每行输入一帧，错误行不会影响其他帧' : undefined} />{legacy.error && !batch && <p className="mb-3 text-xs text-red-400">{legacy.error}</p>}{legacy.value && !batch && <div className="space-y-2"><ToolResultRow label="字节数" value={legacy.value.length} /><ToolResultRow label="CRC16" value={legacy.value.crc16} /><ToolResultRow label="Modbus 线序" value={legacy.value.wire} /><ToolResultRow label="CRC32" value={legacy.value.crc32} /><ToolResultRow label="反转字节序" value={legacy.value.reverse} /></div>}</section>
    <section className="rounded-xl border border-[#30363d] bg-[#111820] p-4"><div className="grid gap-3 sm:grid-cols-3"><label className="text-[11px] text-gray-500">CRC 参数模型<select aria-label="CRC 参数模型" value={preset} onChange={event => selectPreset(event.target.value)} className="field mt-1"><option value="crc16-modbus">CRC-16/MODBUS</option><option value="crc16-ccitt-false">CRC-16/CCITT-FALSE</option><option value="crc32-iso-hdlc">CRC-32/ISO-HDLC</option><option value="custom">自定义参数</option></select></label>{!batch && <><label className="text-[11px] text-gray-500">起始字节偏移（包含）<input aria-label="起始字节偏移" value={start} onChange={event => setStart(event.target.value)} type="number" min="0" className="field mt-1" /></label><label className="text-[11px] text-gray-500">结束字节偏移（不包含）<input aria-label="结束字节偏移" value={end} onChange={event => setEnd(event.target.value)} type="number" min="0" placeholder="留空表示末尾" className="field mt-1" /></label></>}</div>
      {preset === 'custom' && <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6"><label className="text-[10px] text-gray-600">位宽<input aria-label="CRC 位宽" value={width} onChange={event => setWidth(event.target.value)} type="number" min="8" max="32" className="field mt-1" /></label><label className="text-[10px] text-gray-600">多项式<input aria-label="CRC 多项式" value={polynomial} onChange={event => setPolynomial(event.target.value)} className="field mt-1 font-mono" /></label><label className="text-[10px] text-gray-600">初始值<input aria-label="CRC 初始值" value={initial} onChange={event => setInitial(event.target.value)} className="field mt-1 font-mono" /></label><label className="text-[10px] text-gray-600">结果异或<input aria-label="CRC 结果异或" value={xorOutput} onChange={event => setXorOutput(event.target.value)} className="field mt-1 font-mono" /></label><label className="flex items-end gap-1 pb-2 text-[10px] text-gray-500"><input type="checkbox" checked={reflectInput} onChange={event => setReflectInput(event.target.checked)} />RefIn</label><label className="flex items-end gap-1 pb-2 text-[10px] text-gray-500"><input type="checkbox" checked={reflectOutput} onChange={event => setReflectOutput(event.target.checked)} />RefOut</label></div>}
      {calculated.error && <p role="alert" className="mt-3 text-xs text-red-400">{calculated.error}</p>}{calculated.single && <div className="mt-3 space-y-2"><ToolResultRow label="校验范围" value={`${calculated.single.start}..${calculated.single.end}（${calculated.single.checkedLength}/${calculated.single.totalLength} 字节）`} /><ToolResultRow label="计算结果" value={calculated.single.hex} /><ToolResultRow label="大端线序" value={calculated.single.wireBigEndian} /><ToolResultRow label="小端线序" value={calculated.single.wireLittleEndian} /></div>}
      {batch && calculated.rows.length > 0 && <div className="mt-3 max-h-64 overflow-auto rounded border border-[#30363d]"><table className="w-full text-left text-[11px]"><thead className="sticky top-0 bg-[#0d1117] text-gray-600"><tr><th className="px-3 py-2">行</th><th>输入</th><th>结果</th><th>状态</th></tr></thead><tbody>{calculated.rows.map(row => <tr key={row.line} className="border-t border-[#30363d]/60"><td className="px-3 py-2">{row.line}</td><td className="max-w-72 truncate font-mono">{row.input}</td><td className="font-mono text-blue-300">{row.result?.hex ?? '—'}</td><td className={row.error ? 'text-red-400' : 'text-green-400'}>{row.error || '正常'}</td></tr>)}</tbody></table></div>}
      <details className="mt-4"><summary className="cursor-pointer text-xs text-gray-400">生成可移植 C 参考实现</summary><p className="mt-2 text-[10px] text-yellow-400">请先用设备协议给出的 check 向量或抓包结果验证，再集成到固件；生成代码不替代协议确认。</p><textarea aria-label="CRC C 代码" readOnly value={code} rows={12} className="field mt-2 resize-y font-mono text-[10px]" /></details>
    </section>
  </div>;
}
