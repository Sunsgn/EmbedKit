import { useMemo, useState } from 'react';
import ToolResultRow from '../../features/toolbox/ToolResultRow';
import { calculateCrcSummary, type CrcInputMode } from './crc';

export default function CrcTool() {
  const [value, setValue] = useState('01 03 00 00 00 02');
  const [mode, setMode] = useState<CrcInputMode>('hex');
  const result = useMemo(() => { try { return { value: calculateCrcSummary(value, mode), error: '' }; } catch (error) { return { value: null, error: error instanceof Error ? error.message : String(error) }; } }, [mode, value]);
  return <><div className="mb-2 flex gap-2 text-xs">{(['hex', 'text'] as const).map(item => <button key={item} onClick={() => setMode(item)} className={`rounded-md px-2.5 py-1 ${mode === item ? 'bg-blue-500/20 text-blue-300' : 'bg-[#0d1117] text-gray-500'}`}>{item === 'hex' ? 'HEX 字节' : 'UTF-8 文本'}</button>)}</div><textarea value={value} onChange={event => setValue(event.target.value)} rows={3} className="mb-3 w-full resize-none rounded-lg border border-[#30363d] bg-[#0d1117] p-3 font-mono text-sm outline-none focus:border-blue-500" />{result.error && <p className="mb-3 text-xs text-red-400">{result.error}</p>}{result.value && <div className="space-y-2"><ToolResultRow label="字节数" value={result.value.length} /><ToolResultRow label="CRC16" value={result.value.crc16} /><ToolResultRow label="Modbus 线序" value={result.value.wire} /><ToolResultRow label="CRC32" value={result.value.crc32} /><ToolResultRow label="反转字节序" value={result.value.reverse} /></div>}</>;
}
