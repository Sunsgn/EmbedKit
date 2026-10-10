import { useMemo, useState } from 'react';
import ToolResultRow from '../../features/toolbox/ToolResultRow';
import { convertInteger, type IntegerRadix } from './number';

export default function NumberTool() {
  const [value, setValue] = useState('255');
  const [radix, setRadix] = useState<IntegerRadix>(10);
  const result = useMemo(() => {
    try {
      return { value: convertInteger(value, radix), error: '' };
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : String(error) };
    }
  }, [radix, value]);

  return <><div className="mb-3 flex gap-2"><select value={radix} onChange={event => setRadix(Number(event.target.value) as IntegerRadix)} className="rounded-lg border border-[#30363d] bg-[#0d1117] px-3 text-xs outline-none"><option value={10}>十进制</option><option value={16}>十六进制</option><option value={2}>二进制</option><option value={8}>八进制</option></select><input value={value} onChange={event => setValue(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 font-mono text-sm outline-none focus:border-blue-500" /></div>{result.error && <p className="mb-3 text-xs text-red-400">{result.error}</p>}<div className="space-y-2"><ToolResultRow label="DEC" value={result.value?.decimal ?? ''} /><ToolResultRow label="HEX" value={result.value?.hex ?? ''} /><ToolResultRow label="BIN" value={result.value?.binary ?? ''} /><ToolResultRow label="OCT" value={result.value?.octal ?? ''} /></div></>;
}
