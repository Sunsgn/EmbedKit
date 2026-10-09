import { useMemo, useState, type ReactNode } from 'react';
import { Activity, Binary, Calculator, Check, ChevronRight, CircuitBoard, Copy, FileCode2, Gauge, Hash, Map as MapIcon, Replace, Timer, Wrench, X } from 'lucide-react';
import { crc16Modbus, crc32, float32Representations, formatHex, parseHexBytes, parseInteger, swapEndian } from '../utils/embeddedTools';
import { AdcTool, BinaryTool, CanFrameTool, IntelHexTool, MapQuickTool, TimerPwmTool } from '../features/toolbox/AdvancedTools';

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
  type ToolId = 'number' | 'crc' | 'float' | 'uart' | 'can' | 'timer' | 'adc' | 'ihex' | 'bin' | 'map';
  const [activeId, setActiveId] = useState<ToolId | null>(null);
  const tools = [
    { id: 'number' as const, title: '进制转换', description: '地址、寄存器和位掩码', detail: '支持任意长度整数及二、八、十、十六进制互转。', icon: Binary, content: <NumberConverter /> },
    { id: 'crc' as const, title: 'CRC 与字节序', description: '校验、HEX 与大小端', detail: 'CRC16-Modbus、CRC32、HEX 解析与大小端反转。', icon: Hash, content: <CrcCalculator /> },
    { id: 'float' as const, title: 'IEEE 754 Float32', description: '浮点位模式与字节序', detail: '查看浮点数的位模式及大端、小端字节序。', icon: Replace, content: <FloatConverter /> },
    { id: 'uart' as const, title: 'UART 传输时间', description: '帧格式、吞吐量和耗时', detail: '根据波特率与帧格式计算有效吞吐量和理论传输时间。', icon: Gauge, content: <UartCalculator /> },
    { id: 'can' as const, title: 'CAN 帧分析', description: 'ID、DLC、位数和总线时间', detail: '分析经典 CAN 标准帧和扩展帧，估算位填充后的最坏总线占用。', icon: CircuitBoard, content: <CanFrameTool /> },
    { id: 'timer' as const, title: '定时器 / PWM', description: 'PSC、ARR、CCR 与频率', detail: '根据定时器时钟和寄存器参数计算频率、周期、占空比与分辨率。', icon: Timer, content: <TimerPwmTool /> },
    { id: 'adc' as const, title: 'ADC 与分压', description: '量化、电压和电阻分压', detail: '把 ADC 原始值换算为引脚电压、量程比例和分压前电压。', icon: Activity, content: <AdcTool /> },
    { id: 'ihex' as const, title: 'Intel HEX', description: '记录校验、地址与 BIN 导出', detail: '校验 Intel HEX 记录、解析扩展地址并生成空洞填充为 FF 的 BIN。', icon: FileCode2, content: <IntelHexTool /> },
    { id: 'bin' as const, title: 'BIN 文件', description: '大小、CRC 和内容概览', detail: '在浏览器本地分析二进制文件的大小、CRC32、空白比例和头尾字节。', icon: Binary, content: <BinaryTool /> },
    { id: 'map' as const, title: 'MAP 快速分析', description: '内存、模块、风险和优化', detail: '复用通用 MAP 解析器，快速查看格式、覆盖率、Flash/RAM 和优化建议。', icon: MapIcon, content: <MapQuickTool /> },
  ];
  const active = tools.find(tool => tool.id === activeId) ?? null;

  return <div className="h-full overflow-y-auto p-5 scrollbar-thin lg:p-8"><div className="mx-auto max-w-7xl"><header className="mb-6"><div className="mb-2 flex items-center gap-2 text-xs text-orange-400"><Wrench size={15} /> EMBEDDED UTILITIES</div><h1 className="text-2xl font-bold">嵌入式工具箱</h1><p className="mt-2 text-sm text-gray-500">选择工具后再打开具体功能；所有计算均在本地完成，不上传输入内容。</p></header>
    <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <nav aria-label="嵌入式工具目录" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">{tools.map(({ id, title, description, icon: Icon }) => <button key={id} type="button" aria-pressed={activeId === id} onClick={() => setActiveId(id)} className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition ${activeId === id ? 'border-blue-500/50 bg-blue-500/10' : 'border-[#30363d] bg-[#161b22] hover:border-[#484f58]'}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${activeId === id ? 'bg-blue-500/20 text-blue-300' : 'bg-[#0d1117] text-gray-500'}`}><Icon size={17} /></span><span className="min-w-0 flex-1"><b className="block text-sm text-gray-200">{title}</b><small className="block truncate text-[11px] text-gray-600">{description}</small></span><ChevronRight size={14} className={activeId === id ? 'text-blue-400' : 'text-gray-700 group-hover:text-gray-500'} /></button>)}</nav>
      <div className="min-h-72">{active ? <div className="relative"><button type="button" onClick={() => setActiveId(null)} className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-gray-600 hover:bg-white/5 hover:text-white" aria-label="关闭当前工具"><X size={15} /></button><ToolCard title={active.title} description={active.detail} icon={active.icon}>{active.content}</ToolCard></div> : <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-[#30363d] bg-[#161b22]/40 p-8 text-center"><Calculator size={28} className="mb-3 text-gray-700" /><p className="text-sm text-gray-400">从左侧选择一个工具</p><p className="mt-1 text-xs text-gray-600">只显示当前工具的参数与计算结果，避免多个功能同时堆叠。</p></div>}</div>
    </div>
    <div className="mt-5 rounded-xl border border-dashed border-[#30363d] p-4 text-center text-xs text-gray-600"><Calculator size={15} className="mr-2 inline" />10 个工具均可离线独立使用；文件只在浏览器本地读取，不上传。</div>
  </div></div>;
}
