import { useMemo, useState, type ReactNode } from 'react';
import { Binary, Calculator, Check, Copy, Gauge, Hash, Replace, Wrench } from 'lucide-react';
import { crc16Modbus, crc32, float32Representations, formatHex, parseHexBytes, parseInteger, swapEndian } from '../utils/embeddedTools';

function ResultRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="flex items-center gap-3 rounded-lg bg-[#0d1117] px-3 py-2"><span className="w-24 shrink-0 text-[11px] text-gray-600">{label}</span><code className="min-w-0 flex-1 break-all text-xs text-gray-200">{value || '—'}</code><button onClick={() => { void navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1200); }} disabled={!value} className="text-gray-600 hover:text-blue-400 disabled:opacity-30" title="复制">{copied ? <Check size={13} /> : <Copy size={13} />}</button></div>;
}

function ToolCard({ title, description, icon: Icon, children }: { title: string; description: string; icon: typeof Binary; children: ReactNode }) {
  return <section className="rounded-xl border border-[#30363d] bg-[#161b22] p-5"><div className="mb-4 flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400"><Icon size={18} /></span><div><h2 className="text-sm font-semibold text-white">{title}</h2><p className="mt-1 text-xs text-gray-500">{description}</p></div></div>{children}</section>;
}

function NumberConverter() {
  const [value, setValue] = useState('255');
  const [radix, setRadix] = useState(10);
  const result = useMemo(() => { try { const number = parseInteger(value, radix); return { decimal: number.toString(10), hex: `${number < 0 ? '-' : ''}0x${(number < 0 ? -number : number).toString(16).toUpperCase()}`, binary: `${number < 0 ? '-' : ''}0b${(number < 0 ? -number : number).toString(2)}`, octal: `${number < 0 ? '-' : ''}0o${(number < 0 ? -number : number).toString(8)}`, error: '' }; } catch (error) { return { decimal: '', hex: '', binary: '', octal: '', error: error instanceof Error ? error.message : String(error) }; } }, [radix, value]);
  return <><div className="mb-3 flex gap-2"><select value={radix} onChange={event => setRadix(Number(event.target.value))} className="rounded-lg border border-[#30363d] bg-[#0d1117] px-3 text-xs outline-none"><option value={10}>十进制</option><option value={16}>十六进制</option><option value={2}>二进制</option><option value={8}>八进制</option></select><input value={value} onChange={event => setValue(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 font-mono text-sm outline-none focus:border-blue-500" /></div>{result.error && <p className="mb-3 text-xs text-red-400">{result.error}</p>}<div className="space-y-2"><ResultRow label="DEC" value={result.decimal} /><ResultRow label="HEX" value={result.hex} /><ResultRow label="BIN" value={result.binary} /><ResultRow label="OCT" value={result.octal} /></div></>;
}

function CrcCalculator() {
  const [value, setValue] = useState('01 03 00 00 00 02');
  const [mode, setMode] = useState<'hex' | 'text'>('hex');
  const result = useMemo(() => { try { const bytes = mode === 'hex' ? parseHexBytes(value) : new TextEncoder().encode(value); const modbus = crc16Modbus(bytes); return { bytes: formatHex(bytes), length: String(bytes.length), crc16: `0x${modbus.toString(16).padStart(4, '0').toUpperCase()}`, wire: `${(modbus & 0xff).toString(16).padStart(2, '0').toUpperCase()} ${(modbus >>> 8).toString(16).padStart(2, '0').toUpperCase()}`, crc32: `0x${crc32(bytes).toString(16).padStart(8, '0').toUpperCase()}`, reverse: formatHex(swapEndian(bytes)), error: '' }; } catch (error) { return { bytes: '', length: '', crc16: '', wire: '', crc32: '', reverse: '', error: error instanceof Error ? error.message : String(error) }; } }, [mode, value]);
  return <><div className="mb-2 flex gap-2 text-xs">{(['hex', 'text'] as const).map(item => <button key={item} onClick={() => setMode(item)} className={`rounded-md px-2.5 py-1 ${mode === item ? 'bg-blue-500/20 text-blue-300' : 'bg-[#0d1117] text-gray-500'}`}>{item === 'hex' ? 'HEX 字节' : 'UTF-8 文本'}</button>)}</div><textarea value={value} onChange={event => setValue(event.target.value)} rows={3} className="mb-3 w-full resize-none rounded-lg border border-[#30363d] bg-[#0d1117] p-3 font-mono text-sm outline-none focus:border-blue-500" />{result.error && <p className="mb-3 text-xs text-red-400">{result.error}</p>}<div className="space-y-2"><ResultRow label="字节数" value={result.length} /><ResultRow label="CRC16" value={result.crc16} /><ResultRow label="Modbus 线序" value={result.wire} /><ResultRow label="CRC32" value={result.crc32} /><ResultRow label="反转字节序" value={result.reverse} /></div></>;
}

function FloatConverter() {
  const [value, setValue] = useState('3.1415926');
  const result = useMemo(() => { try { return { ...float32Representations(Number(value)), error: '' }; } catch (error) { return { hex: '', binary: '', bytesLE: '', bytesBE: '', error: error instanceof Error ? error.message : String(error) }; } }, [value]);
  return <><input value={value} onChange={event => setValue(event.target.value)} type="number" step="any" className="mb-3 w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 font-mono text-sm outline-none focus:border-blue-500" />{result.error && <p className="mb-3 text-xs text-red-400">{result.error}</p>}<div className="space-y-2"><ResultRow label="Float32 HEX" value={result.hex} /><ResultRow label="大端字节" value={result.bytesBE} /><ResultRow label="小端字节" value={result.bytesLE} /><ResultRow label="二进制" value={result.binary} /></div></>;
}

function UartCalculator() {
  const [baud, setBaud] = useState('115200');
  const [bytes, setBytes] = useState('1024');
  const [dataBits, setDataBits] = useState('8');
  const [parity, setParity] = useState(false);
  const [stopBits, setStopBits] = useState('1');
  const result = useMemo(() => { const rate = Number(baud); const length = Number(bytes); const bitsPerFrame = 1 + Number(dataBits) + (parity ? 1 : 0) + Number(stopBits); if (!(rate > 0) || !(length >= 0)) return null; return { bitsPerFrame, bytesPerSecond: rate / bitsPerFrame, duration: length * bitsPerFrame / rate }; }, [baud, bytes, dataBits, parity, stopBits]);
  return <><div className="mb-3 grid grid-cols-2 gap-2"><label className="text-[11px] text-gray-500">波特率<input value={baud} onChange={event => setBaud(event.target.value)} type="number" className="mt-1 w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-white" /></label><label className="text-[11px] text-gray-500">数据字节<input value={bytes} onChange={event => setBytes(event.target.value)} type="number" className="mt-1 w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-white" /></label><label className="text-[11px] text-gray-500">数据位<select value={dataBits} onChange={event => setDataBits(event.target.value)} className="mt-1 w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-white"><option>7</option><option>8</option></select></label><label className="text-[11px] text-gray-500">停止位<select value={stopBits} onChange={event => setStopBits(event.target.value)} className="mt-1 w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-white"><option>1</option><option>2</option></select></label></div><label className="mb-3 flex items-center gap-2 text-xs text-gray-500"><input type="checkbox" checked={parity} onChange={event => setParity(event.target.checked)} className="accent-blue-500" />启用校验位</label><div className="space-y-2"><ResultRow label="每帧位数" value={result ? String(result.bitsPerFrame) : ''} /><ResultRow label="有效字节/秒" value={result ? result.bytesPerSecond.toFixed(2) : ''} /><ResultRow label="理论耗时" value={result ? `${(result.duration * 1000).toFixed(3)} ms` : ''} /></div></>;
}

export default function ToolboxPage() {
  return <div className="h-full overflow-y-auto p-5 scrollbar-thin lg:p-8"><div className="mx-auto max-w-7xl"><header className="mb-6"><div className="mb-2 flex items-center gap-2 text-xs text-orange-400"><Wrench size={15} /> EMBEDDED UTILITIES</div><h1 className="text-2xl font-bold">嵌入式工具箱</h1><p className="mt-2 text-sm text-gray-500">常用计算和数据转换全部在本地完成，不上传输入内容。</p></header><div className="grid items-start gap-4 xl:grid-cols-2"><ToolCard title="进制转换" description="支持任意长度整数，适合地址、寄存器和位掩码。" icon={Binary}><NumberConverter /></ToolCard><ToolCard title="CRC 与字节序" description="CRC16-Modbus、CRC32、HEX 解析与大小端反转。" icon={Hash}><CrcCalculator /></ToolCard><ToolCard title="IEEE 754 Float32" description="查看浮点数的位模式及大端、小端字节序。" icon={Replace}><FloatConverter /></ToolCard><ToolCard title="UART 传输时间" description="根据帧格式计算有效吞吐量和理论传输时间。" icon={Gauge}><UartCalculator /></ToolCard></div><div className="mt-5 rounded-xl border border-dashed border-[#30363d] p-4 text-center text-xs text-gray-600"><Calculator size={15} className="mr-2 inline" />后续将增加 CAN 帧、定时器/PWM、ADC、Intel HEX、BIN 与 MAP 文件工具。</div></div></div>;
}
