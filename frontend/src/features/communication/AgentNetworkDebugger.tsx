import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Plus, Search, Send, Server, Trash2, Unplug, X } from 'lucide-react';
import { closeNetworkSession, getNetworkStatus, listNetworkSessions, openNetworkSession, readNetworkSession, sendNetworkData, type NetworkAgentEvent as EventItem, type NetworkAgentSession as AgentSession, type NetworkMode as Mode, type NetworkProtocol as Protocol } from '../../services/networkAgent';

type Role = 'tcp-client' | 'tcp-server' | 'udp-client' | 'udp-server';
interface Session extends Omit<AgentSession, 'events'> { logs: EventItem[] }
interface History { data: string; hex: boolean }

const HISTORY_KEY = 'embedkit.network.send-history';
const loadHistory = () => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as History[]; } catch { return []; } };
const parts = (value: Role) => value.split('-') as [Protocol, Mode];
const roleName = (type: Protocol, mode: Mode = 'client') => `${type.toUpperCase()} ${mode === 'client' ? 'Client' : 'Server'}`;
const title = (session: Session) => `${roleName(session.type, session.mode)} · ${session.host}:${session.port}`;

export default function AgentNetworkDebugger() {
  const [role, setRole] = useState<Role>('tcp-client');
  const [host, setHost] = useState('127.0.0.1'), [port, setPort] = useState('9000'), [localPort, setLocalPort] = useState('0');
  const [sessions, setSessions] = useState<Session[]>([]), [activeId, setActiveId] = useState<string | null>(null);
  const [split, setSplit] = useState(false), [leftId, setLeftId] = useState<string | null>(null), [rightId, setRightId] = useState<string | null>(null);
  const [input, setInput] = useState(''), [hexMode, setHexMode] = useState(false), [rxHex, setRxHex] = useState(false);
  const [history, setHistory] = useState<History[]>(loadHistory), [cycle, setCycle] = useState(false), [cycleMs, setCycleMs] = useState('1000');
  const [available, setAvailable] = useState<boolean | null>(null), [error, setError] = useState(''), [filter, setFilter] = useState('');
  const [showRx, setShowRx] = useState(true), [showTx, setShowTx] = useState(true), [timestamps, setTimestamps] = useState(true), [autoScroll, setAutoScroll] = useState(true);
  const sessionRef = useRef<Session[]>([]), lastIds = useRef(new Map<string, number>());
  const leftOutput = useRef<HTMLDivElement>(null), rightOutput = useRef<HTMLDivElement>(null);
  const [protocol, mode] = parts(role);
  const active = sessions.find(item => item.id === activeId) ?? null;
  const left = split ? sessions.find(item => item.id === leftId) ?? null : active;
  const right = split ? sessions.find(item => item.id === rightId) ?? null : null;

  useEffect(() => { sessionRef.current = sessions; }, [sessions]);
  useEffect(() => { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }, [history]);
  useEffect(() => {
    let stopped = false;
    const check = async () => { try { await getNetworkStatus(); if (!stopped) setAvailable(true); } catch { if (!stopped) setAvailable(false); } };
    const restore = async () => { try { const result = await listNetworkSessions(); if (stopped) return; const restored = result.map(item => ({ ...item, logs: item.events })); restored.forEach(item => { const latest = item.logs[item.logs.length - 1]?.id ?? 0; lastIds.current.set(item.id, latest); }); setSessions(restored); setActiveId(current => current ?? restored[0]?.id ?? null); } catch { /* Agent 状态轮询会显示离线 */ } };
    void restore();
    void check(); const timer = window.setInterval(() => void check(), 3000);
    return () => { stopped = true; clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!sessions.length) return;
    let stopped = false, timer = 0;
    const poll = async () => {
      await Promise.all(sessionRef.current.map(async item => {
        try {
          const current = await readNetworkSession(item.id, lastIds.current.get(item.id) ?? 0);
          if (stopped) return;
          if (current.events.length) lastIds.current.set(item.id, current.events[current.events.length - 1].id);
          setSessions(all => all.map(old => old.id === item.id ? { ...current, logs: [...old.logs, ...current.events].slice(-2000) } : old));
        } catch (reason) { if (!stopped) setError(reason instanceof Error ? reason.message : String(reason)); }
      }));
      if (!stopped) timer = window.setTimeout(poll, 300);
    };
    void poll(); return () => { stopped = true; clearTimeout(timer); };
  }, [sessions.length]);

  const create = async () => {
    setError('');
    try {
      const data = await openNetworkSession({ type: protocol, mode, host, port: Number(port), localPort: Number(localPort) });
      if (data.events.length) lastIds.current.set(data.id, data.events[data.events.length - 1].id);
      const created: Session = { id: data.id, type: data.type, mode: data.mode, host: data.host, port: data.port, localAddress: data.localAddress, state: data.state, rxBytes: data.rxBytes, txBytes: data.txBytes, clientCount: data.clientCount, logs: data.events };
      setSessions(all => [...all, created]); setActiveId(data.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const close = useCallback(async (id: string) => {
    await closeNetworkSession(id).catch(() => undefined); lastIds.current.delete(id); setCycle(false);
    setSessions(all => { const remaining = all.filter(item => item.id !== id); setActiveId(current => current === id ? remaining[0]?.id ?? null : current); setLeftId(current => current === id ? remaining[0]?.id ?? null : current); setRightId(current => current === id ? remaining[1]?.id ?? remaining[0]?.id ?? null : current); if (remaining.length < 2) setSplit(false); return remaining; });
  }, []);
  const send = useCallback(async (data: string, encoding: 'text' | 'hex', clear: boolean) => {
    const target = sessionRef.current.find(item => item.id === activeId); if (!target || !data) return;
    try {
      await sendNetworkData(target.id, data, encoding);
      setHistory(all => [{ data, hex: encoding === 'hex' }, ...all.filter(item => item.data !== data || item.hex !== (encoding === 'hex'))].slice(0, 30)); if (clear) setInput('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setCycle(false); }
  }, [activeId]);

  const online = active?.state === 'connected';
  const canSend = Boolean(online && (active?.mode === 'client' || active?.type === 'tcp' && (active.clientCount || 0) > 0 || active?.type === 'udp' && active.rxBytes > 0));
  const visible = useCallback((session: Session | null) => { const query = filter.trim().toLowerCase(); return session?.logs.filter(item => (item.direction === 'system' || item.direction === 'rx' && showRx || item.direction === 'tx' && showTx) && (!query || `${item.text} ${item.hex} ${item.peer ?? ''} ${item.direction}`.toLowerCase().includes(query))) ?? []; }, [filter, showRx, showTx]);
  const leftLogs = useMemo(() => visible(left), [left, visible]), rightLogs = useMemo(() => visible(right), [right, visible]);
  useEffect(() => { if (autoScroll) { if (leftOutput.current) leftOutput.current.scrollTop = leftOutput.current.scrollHeight; if (rightOutput.current) rightOutput.current.scrollTop = rightOutput.current.scrollHeight; } }, [autoScroll, leftLogs, rightLogs]);
  useEffect(() => { if (!cycle || !canSend || !input) return; const timer = setInterval(() => void send(input, hexMode ? 'hex' : 'text', false), Math.max(100, Number(cycleMs) || 1000)); return () => clearInterval(timer); }, [canSend, cycle, cycleMs, hexMode, input, send]);

  const selectRole = (next: Role) => { const [, nextMode] = parts(next); setRole(next); if (nextMode === 'server' && host === '127.0.0.1') setHost('0.0.0.0'); if (nextMode === 'client' && host === '0.0.0.0') setHost('127.0.0.1'); };
  const choose = (item: Session) => { setActiveId(item.id); if (split) { if (activeId === rightId) setRightId(item.id); else setLeftId(item.id); } };
  const selectPane = (side: 'left' | 'right', id: string) => { if (side === 'left') setLeftId(id); else setRightId(id); setActiveId(id); };
  const toggleSplit = () => { if (split) return setSplit(false); if (sessions.length < 2) return; const first = active ?? sessions[0], second = sessions.find(item => item.id !== first.id)!; setLeftId(first.id); setRightId(second.id); setActiveId(first.id); setSplit(true); };
  const exportLogs = () => { if (!active?.logs.length) return; const content = active.logs.map(item => `[${item.timestamp}] [${item.direction.toUpperCase()}] ${item.direction === 'rx' && rxHex ? item.hex : item.text}`).join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' })); link.download = `${active.type}-${active.mode}-${Date.now()}.log`; link.click(); URL.revokeObjectURL(link.href); };
  const renderPane = (session: Session | null, logs: EventItem[], side: 'left' | 'right') => <div onClick={() => session && setActiveId(session.id)} className={`flex min-h-0 min-w-0 flex-col overflow-hidden border ${session?.id === activeId ? 'border-purple-500/70' : 'border-transparent'} ${split && side === 'right' ? 'lg:border-l-[#30363d]' : ''}`}>
    {split && <div className={`flex shrink-0 items-center gap-2 border-b px-2.5 py-1.5 ${session?.id === activeId ? 'border-purple-500/40 bg-purple-500/10' : 'border-[#30363d] bg-[#0b1016]'}`}><select aria-label={`${side === 'left' ? '左侧' : '右侧'}网络会话`} value={session?.id ?? ''} onChange={event => selectPane(side, event.target.value)} className="min-w-0 flex-1 rounded border border-[#30363d] bg-[#161b22] px-2 py-1 text-[11px] text-gray-300">{sessions.map(item => <option key={item.id} value={item.id}>{title(item)}</option>)}</select><span className="shrink-0 text-[9px] text-gray-600">RX {session?.rxBytes ?? 0} · TX {session?.txBytes ?? 0}</span>{session?.id === activeId && <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[9px] text-purple-300">发送目标</span>}</div>}
    <div ref={side === 'left' ? leftOutput : rightOutput} className="min-h-0 flex-1 overflow-y-auto bg-[#090d12] px-3 py-3 font-mono text-[12px] leading-5 scrollbar-thin lg:px-4 lg:text-[13px]">{logs.map(item => <div key={item.id} className="serial-terminal-row flex gap-2 rounded px-1"><span className="shrink-0 text-gray-700">{timestamps && new Date(item.timestamp).toLocaleTimeString('zh-CN', { hour12: false, fractionalSecondDigits: 3 })}</span><span className={`w-7 shrink-0 text-[10px] font-semibold ${item.direction === 'rx' ? 'text-green-500' : item.direction === 'tx' ? 'text-blue-400' : 'text-yellow-500'}`}>{item.direction === 'system' ? 'SYS' : item.direction.toUpperCase()}</span><span className="break-all whitespace-pre-wrap text-gray-300">{item.direction === 'rx' && rxHex ? item.hex : item.text}</span>{item.peer && <span className="ml-auto shrink-0 text-[10px] text-gray-700">{item.peer}</span>}</div>)}</div>
  </div>;

  return <div className="serial-page h-full overflow-hidden p-3 lg:p-4"><div className="mx-auto flex h-full min-h-0 max-w-[1600px] flex-col">
    <header className="mb-2 flex shrink-0 items-center justify-between gap-2"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-400"><Server size={18} /></span><div><h1 className="text-base font-semibold text-gray-100">TCP / UDP 调试</h1><p className="text-[11px] text-gray-600">协议角色合并 · 多会话 · 双窗口对照</p></div></div><span className={`rounded-full border px-3 py-1 text-[11px] ${available ? 'border-green-500/30 bg-green-500/10 text-green-400' : available === false ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-[#30363d] text-gray-500'}`}>Local Agent：{available ? `已连接 · ${sessions.length} 个会话` : available === false ? '未运行' : '检测中'}</span></header>
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#30363d] bg-[#0d1117] shadow-2xl shadow-black/20">
      <div className="flex min-h-0 flex-1 flex-col"><div className="flex shrink-0 items-center gap-2 border-b border-[#30363d] bg-[#0b1016] px-3 py-2"><Search size={13} className="text-gray-600" /><input value={filter} onChange={event => setFilter(event.target.value)} placeholder={split ? '同时搜索左右日志…' : '搜索当前会话日志…'} className="flex-1 bg-transparent text-xs text-gray-300 outline-none placeholder:text-gray-700" />{filter && <button onClick={() => setFilter('')}><X size={12} /></button>}<span className="rounded bg-[#161b22] px-2 py-0.5 text-[10px] text-gray-600">{leftLogs.length + rightLogs.length}/{(left?.logs.length ?? 0) + (right?.logs.length ?? 0)}</span></div><div className={`grid min-h-0 flex-1 ${split ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>{renderPane(left, leftLogs, 'left')}{split && renderPane(right, rightLogs, 'right')}</div></div>
      <div className="shrink-0 border-t border-[#30363d] bg-[#0b1016] px-3 py-3"><div className="mb-2 flex min-h-7 flex-wrap items-center gap-3 border-b border-[#30363d] pb-2 text-xs"><b className="text-gray-300">{active ? title(active) : '未选择网络会话'}</b><span className={online ? 'text-green-400' : 'text-gray-500'}>{online ? active?.mode === 'server' ? '● 监听中' : '● 在线' : '● 离线'}</span>{active?.type === 'tcp' && active.mode === 'server' && <span className="text-gray-500">客户端 {active.clientCount || 0}</span>}<span className="text-gray-500">RX {active?.rxBytes || 0} B</span><span className="text-gray-500">TX {active?.txBytes || 0} B</span><div className="ml-auto flex items-center gap-2 text-gray-400"><label><input type="checkbox" checked={showRx} onChange={event => setShowRx(event.target.checked)} /> RX</label><label><input type="checkbox" checked={showTx} onChange={event => setShowTx(event.target.checked)} /> TX</label><label><input type="checkbox" checked={rxHex} onChange={event => setRxHex(event.target.checked)} /> HEX</label><label><input type="checkbox" checked={timestamps} onChange={event => setTimestamps(event.target.checked)} /> 时间戳</label><label><input type="checkbox" checked={autoScroll} onChange={event => setAutoScroll(event.target.checked)} /> 跟随</label><button onClick={exportLogs} disabled={!active?.logs.length}><Download size={14} /></button><button onClick={() => activeId && setSessions(all => all.map(item => item.id === activeId ? { ...item, logs: [] } : item))} disabled={!active}><Trash2 size={14} /></button></div></div>
        {available === false && <div className="mb-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-300">请在 proxy 目录运行 <code>npm start</code>。</div>}{error && <div className="mb-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">{error}</div>}
        <div className="grid gap-3 lg:grid-cols-[minmax(540px,1.25fr)_minmax(0,1fr)]"><div className="min-w-0 lg:border-r lg:border-[#30363d] lg:pr-3"><div className="mb-2 flex min-h-8 gap-1.5 overflow-x-auto scrollbar-thin">{sessions.map(item => <div key={item.id} className={`flex shrink-0 overflow-hidden rounded-md border ${activeId === item.id ? 'border-purple-500/60 bg-purple-500/10' : 'border-[#30363d] bg-[#161b22]'}`}><button onClick={() => choose(item)} className="flex items-center gap-1.5 px-2 py-1 text-left"><i className={`h-1.5 w-1.5 rounded-full ${item.state === 'connected' ? 'bg-green-400' : 'bg-gray-600'}`} /><span><b className="block max-w-32 truncate text-[11px] text-gray-200">{roleName(item.type, item.mode)}</b><small className="block max-w-32 truncate text-[8px] text-gray-600">{item.host}:{item.port}</small></span></button><button onClick={() => void close(item.id)} className="border-l border-[#30363d] px-1.5 text-gray-600 hover:text-red-400"><X size={10} /></button></div>)}</div><div className={`grid items-end gap-2 ${protocol === 'udp' && mode === 'client' ? 'grid-cols-[118px_1fr_76px_72px_auto_auto]' : 'grid-cols-[118px_1fr_82px_auto_auto]'}`}><label className="text-[11px] text-gray-500">协议角色<select aria-label="协议角色" value={role} onChange={event => selectRole(event.target.value as Role)} className="field"><option value="tcp-client">TCP Client</option><option value="tcp-server">TCP Server</option><option value="udp-client">UDP Client</option><option value="udp-server">UDP Server</option></select></label><label className="text-[11px] text-gray-500">{mode === 'server' ? '监听地址' : '目标主机'}<input value={host} onChange={event => setHost(event.target.value)} className="field" /></label><label className="text-[11px] text-gray-500">{mode === 'server' ? '监听端口' : '目标端口'}<input value={port} onChange={event => setPort(event.target.value)} type="number" className="field" /></label>{protocol === 'udp' && mode === 'client' && <label className="text-[11px] text-gray-500">本地端口<input value={localPort} onChange={event => setLocalPort(event.target.value)} type="number" className="field" /></label>}<button onClick={() => void create()} disabled={!available} className="flex h-[34px] items-center justify-center gap-1 rounded-lg bg-purple-600 px-3 text-xs text-white disabled:opacity-40"><Plus size={13} />{mode === 'server' ? '添加监听' : '添加连接'}</button>{active && <button onClick={() => void close(active.id)} className="flex h-[34px] items-center gap-1 rounded-lg border border-red-500/30 px-2 text-xs text-red-400"><Unplug size={12} />停止</button>}<button onClick={toggleSplit} disabled={sessions.length < 2} className={`h-[34px] rounded-lg border px-2.5 text-xs disabled:opacity-35 ${split ? 'border-purple-500/40 bg-purple-500/10 text-purple-300' : 'border-[#30363d] text-gray-400'}`}>{split ? '单窗口' : '双窗口'}</button></div></div>
          <div><div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-gray-500"><span className="rounded-md border border-purple-500/25 bg-purple-500/10 px-2 py-1 text-purple-300">发送到：{!online ? '未连接' : active?.mode === 'client' ? `${active.host}:${active.port}` : active?.type === 'tcp' ? `${active.clientCount || 0} 个客户端` : '最近一个 UDP 来源'}</span><label><input type="checkbox" checked={hexMode} onChange={event => setHexMode(event.target.checked)} /> 发送 HEX</label><label><input type="checkbox" checked={cycle} onChange={event => setCycle(event.target.checked)} disabled={!canSend || !input} /> 循环发送</label><input value={cycleMs} onChange={event => setCycleMs(event.target.value)} disabled={!cycle} type="number" min="100" className="w-20 rounded border border-[#30363d] bg-[#161b22] px-2 py-1 disabled:opacity-40" /><span>ms</span>{history.length > 0 && <select defaultValue="" onChange={event => { const item = history[Number(event.target.value)]; if (item) { setInput(item.data); setHexMode(item.hex); } event.currentTarget.value = ''; }} className="ml-auto max-w-44 rounded border border-[#30363d] bg-[#161b22] px-2 py-1"><option value="">发送历史</option>{history.map((item, index) => <option key={`${item.hex}-${item.data}`} value={index}>{item.hex ? 'HEX' : 'TXT'} · {item.data.slice(0, 24)}</option>)}</select>}</div><div className="flex gap-2"><input value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void send(input, hexMode ? 'hex' : 'text', true); }} disabled={!online} placeholder={hexMode ? 'HEX：DE AD BE EF' : '输入文本，Enter 发送'} className="min-w-48 flex-1 rounded-lg border border-[#30363d] bg-[#161b22] px-4 py-2 text-sm outline-none focus:border-purple-500 disabled:opacity-50" /><button onClick={() => void send(input, hexMode ? 'hex' : 'text', true)} disabled={!canSend || !input || cycle} className="flex min-w-20 items-center justify-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm text-white disabled:opacity-40"><Send size={14} />发送</button></div></div></div>
      </div>
    </section>
  </div></div>;
}
