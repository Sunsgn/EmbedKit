import { useEffect, useMemo, useRef, useState } from 'react';
import { Cable, Download, Search, Send, Trash2, Unplug, Wifi, X } from 'lucide-react';
import { formatHex, parseHexBytes } from '../../utils/embeddedTools';

interface NetworkLog { id: number; time: string; direction: 'rx' | 'tx' | 'system'; text: string }

export default function WebSocketDebugger() {
  const [url, setUrl] = useState('ws://localhost:8080');
  const [input, setInput] = useState('');
  const [hexMode, setHexMode] = useState(false);
  const [state, setState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [logs, setLogs] = useState<NetworkLog[]>([]);
  const [filter, setFilter] = useState('');
  const [showRx, setShowRx] = useState(true), [showTx, setShowTx] = useState(true), [timestamps, setTimestamps] = useState(true), [autoScroll, setAutoScroll] = useState(true);
  const socket = useRef<WebSocket | null>(null);
  const output = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const addLog = (direction: NetworkLog['direction'], text: string) => setLogs(previous => [...previous.slice(-999), { id: nextId.current++, time: new Date().toLocaleTimeString('zh-CN', { hour12: false, fractionalSecondDigits: 3 }), direction, text }]);
  const disconnect = () => { socket.current?.close(); socket.current = null; setState('disconnected'); };
  useEffect(() => () => socket.current?.close(), []);
  const shown = useMemo(() => { const query = filter.trim().toLowerCase(); return logs.filter(log => (log.direction === 'system' || log.direction === 'rx' && showRx || log.direction === 'tx' && showTx) && (!query || log.text.toLowerCase().includes(query) || log.direction.includes(query))); }, [filter, logs, showRx, showTx]);
  const recentSends = useMemo(() => logs.filter(log => log.direction === 'tx').slice(-20).reverse(), [logs]);
  useEffect(() => { if (autoScroll && output.current) output.current.scrollTop = output.current.scrollHeight; }, [autoScroll, shown]);

  const connect = () => {
    if (!/^wss?:\/\//i.test(url)) { addLog('system', '地址必须以 ws:// 或 wss:// 开头'); return; }
    setState('connecting');
    try {
      const ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer'; socket.current = ws;
      ws.onopen = () => { setState('connected'); addLog('system', `已连接 ${url}`); };
      ws.onmessage = event => addLog('rx', event.data instanceof ArrayBuffer ? formatHex(new Uint8Array(event.data)) : String(event.data));
      ws.onerror = () => addLog('system', '连接或通信发生错误');
      ws.onclose = event => { setState('disconnected'); socket.current = null; addLog('system', `连接已关闭（${event.code}${event.reason ? `：${event.reason}` : ''}）`); };
    } catch (error) { setState('disconnected'); addLog('system', error instanceof Error ? error.message : String(error)); }
  };

  const send = () => {
    if (socket.current?.readyState !== WebSocket.OPEN || !input) return;
    try {
      if (hexMode) { const bytes = parseHexBytes(input); const binary = new ArrayBuffer(bytes.byteLength); new Uint8Array(binary).set(bytes); socket.current.send(binary); addLog('tx', formatHex(bytes)); }
      else { socket.current.send(input); addLog('tx', input); }
      setInput('');
    } catch (error) { addLog('system', error instanceof Error ? error.message : String(error)); }
  };

  const exportLogs = () => {
    if (!logs.length) return;
    const content = logs.map(log => `[${log.time}] [${log.direction.toUpperCase()}] ${log.text}`).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' })); link.download = `websocket-${Date.now()}.log`; link.click(); URL.revokeObjectURL(link.href);
  };

  const connected = state === 'connected', rxCount = logs.filter(log => log.direction === 'rx').length, txCount = logs.filter(log => log.direction === 'tx').length;
  return <div className="serial-page h-full overflow-hidden p-3 lg:p-4"><div className="mx-auto flex h-full min-h-0 max-w-[1600px] flex-col">
    <header className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-green-500/20 bg-green-500/10 text-green-400"><Wifi size={18} /></span><div><h1 className="text-base font-semibold text-gray-100">WebSocket 调试</h1><p className="text-[11px] text-gray-600">文本与二进制帧 · 发送记录 · 日志导出</p></div></div><span className={`rounded-full border px-3 py-1 text-[11px] ${connected ? 'border-green-500/30 bg-green-500/10 text-green-400' : state === 'connecting' ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400' : 'border-[#30363d] bg-[#161b22] text-gray-500'}`}>{connected ? '● 已连接' : state === 'connecting' ? '● 连接中' : '● 未连接'}</span></header>
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#30363d] bg-[#0d1117] shadow-2xl shadow-black/20">
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_220px] lg:grid-rows-1">
        <div className="flex min-h-0 flex-col"><div className="flex shrink-0 items-center gap-2 border-b border-[#30363d] bg-[#0b1016] px-3 py-2"><Search size={13} className="text-gray-600" /><input value={filter} onChange={event => setFilter(event.target.value)} placeholder="搜索接收、发送和系统日志…" className="flex-1 bg-transparent text-xs text-gray-300 outline-none placeholder:text-gray-700" />{filter && <button onClick={() => setFilter('')} className="text-gray-600 hover:text-white"><X size={12} /></button>}<span className="rounded bg-[#161b22] px-2 py-0.5 text-[10px] text-gray-600">{shown.length}/{logs.length}</span></div><div ref={output} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#090d12] px-4 py-3 font-mono text-[13px] leading-5 scrollbar-thin">{shown.map(log => <div key={log.id} className="serial-terminal-row flex gap-2 rounded px-1"><span className="shrink-0 text-gray-700">{timestamps && log.time}</span><span className={`w-7 shrink-0 text-[10px] font-semibold ${log.direction === 'rx' ? 'text-green-500' : log.direction === 'tx' ? 'text-blue-400' : 'text-yellow-500'}`}>{log.direction === 'system' ? 'SYS' : log.direction.toUpperCase()}</span><span className="break-all whitespace-pre-wrap text-gray-300">{log.text}</span></div>)}</div></div>
        <aside className="max-h-36 min-h-0 overflow-y-auto border-t border-[#30363d] bg-[#0d1117] p-2 scrollbar-thin lg:max-h-none lg:border-t-0 lg:border-l"><div className="mb-2 flex items-center justify-between px-1"><span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">最近发送</span><small className="text-[10px] text-gray-700">{recentSends.length} 条</small></div><div className="space-y-1">{recentSends.map(log => <button key={log.id} onClick={() => setInput(log.text)} className="block w-full truncate rounded-md border border-[#30363d] bg-[#111820] px-2.5 py-1.5 text-left font-mono text-xs text-gray-300 hover:border-green-500/40 hover:bg-green-500/5" title="填入发送框">{log.text}</button>)}</div></aside>
      </div>
      <div className="shrink-0 border-t border-[#30363d] bg-[#0b1016] px-3 py-3"><div className="mb-2 flex min-h-7 flex-wrap items-center gap-3 border-b border-[#30363d] pb-2 text-xs"><b className="max-w-md truncate text-gray-300">{url}</b><span className={connected ? 'text-green-400' : 'text-gray-500'}>{connected ? '● 在线' : '● 离线'}</span><span className="text-gray-500">RX {rxCount} 帧</span><span className="text-gray-500">TX {txCount} 帧</span><div className="ml-auto flex flex-wrap items-center gap-2 text-gray-400"><label><input type="checkbox" checked={showRx} onChange={event => setShowRx(event.target.checked)} /> RX</label><label><input type="checkbox" checked={showTx} onChange={event => setShowTx(event.target.checked)} /> TX</label><label><input type="checkbox" checked={timestamps} onChange={event => setTimestamps(event.target.checked)} /> 时间戳</label><label><input type="checkbox" checked={autoScroll} onChange={event => setAutoScroll(event.target.checked)} /> 跟随</label><button onClick={exportLogs} disabled={!logs.length} title="导出日志" className="disabled:opacity-30"><Download size={14} /></button><button onClick={() => setLogs([])} title="清空"><Trash2 size={14} /></button></div></div>
        <div className="grid gap-3 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.6fr)]"><div className="flex min-w-0 items-end gap-2 lg:border-r lg:border-[#30363d] lg:pr-3"><label className="min-w-0 flex-1 text-[11px] text-gray-500">服务器地址<input value={url} onChange={event => setUrl(event.target.value)} disabled={state !== 'disconnected'} className="mt-1 block w-full rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-2 text-xs text-white outline-none focus:border-green-500 disabled:opacity-50" /></label>{state === 'disconnected' ? <button onClick={connect} className="flex h-[34px] shrink-0 items-center gap-1.5 rounded-lg bg-green-600 px-3 text-xs font-medium text-white hover:bg-green-500"><Cable size={14} />连接</button> : <button onClick={disconnect} className="flex h-[34px] shrink-0 items-center gap-1.5 rounded-lg border border-red-500/30 px-3 text-xs text-red-400"><Unplug size={14} />{state === 'connecting' ? '取消' : '断开'}</button>}</div>
        <div><div className="mb-2 flex items-center gap-3 text-xs text-gray-500"><span className="rounded-md border border-green-500/25 bg-green-500/10 px-2 py-1 text-green-300">发送到：{connected ? url : '未连接'}</span><label className="flex items-center gap-1"><input type="checkbox" checked={hexMode} onChange={event => setHexMode(event.target.checked)} />发送 HEX</label></div><div className="flex gap-2"><input value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') send(); }} disabled={!connected} placeholder={hexMode ? 'HEX：DE AD BE EF' : '输入文本，Enter 发送'} className="min-w-52 flex-1 rounded-lg border border-[#30363d] bg-[#161b22] px-4 py-2 text-sm outline-none placeholder:text-gray-700 focus:border-green-500 disabled:opacity-50" /><button onClick={send} disabled={!connected || !input} className="flex min-w-24 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"><Send size={14} />发送</button></div></div></div>
      </div>
    </section>
  </div></div>;
}
