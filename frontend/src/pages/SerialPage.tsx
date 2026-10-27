import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Braces, Check, Clock3, Download, FileUp, Pause, Pencil, Play, Plus, Radio, Search, Send, Settings, Square, Trash2, Wifi, WifiOff, X } from 'lucide-react';
import { COMMUNICATION_CAPTURE_MAX_BYTES, createCommunicationCapture, writePendingCommunicationCapture, type CaptureEventInput } from '../services/communicationCapture';

type Parity = 'none' | 'even' | 'odd';
type FlowControl = 'none' | 'hardware';
type Direction = 'rx' | 'tx' | 'system';
type State = 'connected' | 'disconnected' | 'connecting' | 'disconnecting';
type FrameMode = 'auto' | 'line' | 'idle' | 'fixed' | 'raw';
interface PortInfo { usbVendorId?: number; usbProductId?: number; bluetoothServiceClassId?: string }
interface Port extends EventTarget { name?: string; path?: string; readable: ReadableStream<Uint8Array> | null; writable: WritableStream<Uint8Array> | null; open(o: { baudRate: number; dataBits: number; stopBits: number; parity: Parity; flowControl: FlowControl; bufferSize?: number }): Promise<void>; close(): Promise<void>; getInfo(): PortInfo; setSignals?(s: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void> }
interface SerialManager extends EventTarget { requestPort(): Promise<Port> }
interface Entry { id: number; timestamp: string; direction: Direction; text: string; bytes?: number[] }
interface Shortcut { id: number; name: string; value: string; hex: boolean; intervalMs?: number }
interface Session { id: number; name: string; state: State; baud: number; config: string; entries: Entry[]; rx: number; tx: number; rate: number; paused: number; captureBytes: number }
interface Runtime { port: Port; reader: ReadableStreamDefaultReader<Uint8Array> | null; reading: boolean; writing: boolean; buffer: number[]; timer: number | null; lastBytes: number; lastTime: number }
interface RawCapture { events: CaptureEventInput[]; byteLength: number; truncated: boolean }

const MAX_ENTRIES = 5000;
const settingsKey = 'embedkit.serial.settings';
const shortcutsKey = 'embedkit.serial.shortcuts';
const shortcutLimitKey = 'embedkit.serial.shortcut-limit';
function loadSettings() { try { return JSON.parse(localStorage.getItem(settingsKey) || '{}') as Record<string, string | boolean>; } catch { return {}; } }
function loadShortcuts(): Shortcut[] { try { return JSON.parse(localStorage.getItem(shortcutsKey) || 'null') as Shortcut[] || []; } catch { return []; } }
function loadShortcutLimit() { const value = Number(localStorage.getItem(shortcutLimitKey) || 20); return Number.isFinite(value) ? Math.max(1, Math.min(100, Math.round(value))) : 20; }
function now() { const d = new Date(); return `${d.toLocaleTimeString('zh-CN', { hour12: false })}.${String(d.getMilliseconds()).padStart(3, '0')}`; }
function hex(bytes: number[]) { return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' '); }
function visibleEntries(session: Session | null, filter: string, rxHex: boolean, showRx: boolean, showTx: boolean) { const q = filter.toLowerCase().trim(); return session?.entries.filter((e) => (e.direction === 'system' || e.direction === 'rx' && showRx || e.direction === 'tx' && showTx) && (!q || (rxHex && e.bytes ? hex(e.bytes) : e.text).toLowerCase().includes(q) || e.direction.includes(q))) ?? []; }
function parseHex(value: string) { const s = value.replace(/0x/gi, '').replace(/[\s,;:_-]+/g, ''); if (!s || !/^[\da-f]+$/i.test(s) || s.length % 2) throw new Error('HEX 必须是完整字节，例如 DE AD BE EF'); return new Uint8Array(s.match(/../g)!.map((v) => parseInt(v, 16))); }
function unescapeText(value: string) { return value.replace(/\\u([\da-f]{4})|\\x([\da-f]{2})|\\([rnt0\\])/gi, (_, unicode: string, byte: string, simple: string) => unicode ? String.fromCharCode(parseInt(unicode, 16)) : byte ? String.fromCharCode(parseInt(byte, 16)) : ({ r: '\r', n: '\n', t: '\t', '0': '\0', '\\': '\\' }[simple] ?? simple)); }
function portName(port: Port, index: number) { const i = port.getInfo(); const detected = [port.name, port.path].map((value) => value?.match(/COM\d+/i)?.[0].toUpperCase()).find(Boolean); const vid = i.usbVendorId?.toString(16).padStart(4, '0').toUpperCase(); const pid = i.usbProductId?.toString(16).padStart(4, '0').toUpperCase(); const label = detected ?? `串口 ${index}`; return vid || pid ? `${label} · VID:${vid ?? '----'} PID:${pid ?? '----'}` : label; }

export default function SerialPage() {
  const [initial] = useState(loadSettings);
  const [sessions, setSessions] = useState<Session[]>([]), [activeId, setActiveId] = useState<number | null>(null), [adding, setAdding] = useState(false);
  const [splitView, setSplitView] = useState(false), [leftPaneId, setLeftPaneId] = useState<number | null>(null), [rightPaneId, setRightPaneId] = useState<number | null>(null);
  const [baud, setBaud] = useState(typeof initial.baud === 'string' ? initial.baud : '115200'), [dataBits, setDataBits] = useState('8'), [stopBits, setStopBits] = useState('1');
  const [parity, setParity] = useState<Parity>('none'), [flow, setFlow] = useState<FlowControl>('none'), [bufferSize, setBufferSize] = useState('65536');
  const [frameMode, setFrameMode] = useState<FrameMode>('auto'), [frameGap, setFrameGap] = useState('30'), [frameLength, setFrameLength] = useState('8');
  const [input, setInput] = useState(''), [lineEnding, setLineEnding] = useState(typeof initial.lineEnding === 'string' ? initial.lineEnding : '\n');
  const [rxHex, setRxHex] = useState(initial.rxHex === true), [txHex, setTxHex] = useState(initial.txHex === true), [localEcho, setLocalEcho] = useState(true);
  const [leftRxHex, setLeftRxHex] = useState(typeof initial.leftRxHex === 'boolean' ? initial.leftRxHex : initial.rxHex === true);
  const [rightRxHex, setRightRxHex] = useState(typeof initial.rightRxHex === 'boolean' ? initial.rightRxHex : initial.rxHex === true);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState(''), [autoScroll, setAutoScroll] = useState(true), [timestamps, setTimestamps] = useState(true), [showSettings, setShowSettings] = useState(false);
  const [dtr, setDtr] = useState(true), [rts, setRts] = useState(false), [cycle, setCycle] = useState(false), [cycleMs, setCycleMs] = useState('1000');
  const [broadcast, setBroadcast] = useState(false), [showRx, setShowRx] = useState(true), [showTx, setShowTx] = useState(true), [escapes, setEscapes] = useState(false);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(loadShortcuts), [shortcutName, setShortcutName] = useState('');
  const [shortcutLimit, setShortcutLimit] = useState(loadShortcutLimit);
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
  const [cyclingShortcutIds, setCyclingShortcutIds] = useState<number[]>([]);
  const [fileProgress, setFileProgress] = useState('');
  const supported = typeof navigator !== 'undefined' && 'serial' in navigator;
  const runtimes = useRef(new Map<number, Runtime>()), rawCaptures = useRef(new Map<number, RawCapture>()), sessionsRef = useRef<Session[]>([]), sessionSeq = useRef(0), entrySeq = useRef(0), output = useRef<HTMLDivElement>(null), secondaryOutput = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused), modeRef = useRef(frameMode), gapRef = useRef(30), lengthRef = useRef(8);
  const active = sessions.find((s) => s.id === activeId) ?? null, connected = active?.state === 'connected', onlineCount = sessions.filter((s) => s.state === 'connected').length, canSend = broadcast ? onlineCount > 0 : connected;
  const leftPane = splitView ? sessions.find((s) => s.id === leftPaneId) ?? null : active, rightPane = splitView ? sessions.find((s) => s.id === rightPaneId) ?? null : null;
  const update = useCallback((id: number, fn: (s: Session) => Session) => setSessions((all) => all.map((s) => s.id === id ? fn(s) : s)), []);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  useEffect(() => { modeRef.current = frameMode; for (const r of runtimes.current.values()) { r.buffer = []; if (r.timer !== null) { clearTimeout(r.timer); r.timer = null; } } }, [frameMode]);
  useEffect(() => { gapRef.current = Math.max(5, Math.min(2000, Number(frameGap) || 30)); }, [frameGap]);
  useEffect(() => { lengthRef.current = Math.max(1, Math.min(4096, Number(frameLength) || 1)); }, [frameLength]);
  useEffect(() => { localStorage.setItem(settingsKey, JSON.stringify({ version: 2, baud, lineEnding, rxHex, leftRxHex, rightRxHex, txHex })); }, [baud, leftRxHex, lineEnding, rightRxHex, rxHex, txHex]);
  useEffect(() => { localStorage.setItem(shortcutsKey, JSON.stringify(shortcuts)); }, [shortcuts]);
  useEffect(() => { localStorage.setItem(shortcutLimitKey, String(shortcutLimit)); }, [shortcutLimit]);

  const append = useCallback((id: number, text: string, direction: Direction, bytes?: Uint8Array) => update(id, (s) => ({ ...s, entries: [...s.entries, { id: ++entrySeq.current, timestamp: now(), direction, text, bytes: bytes ? [...bytes] : undefined }].slice(-MAX_ENTRIES) })), [update]);
  const emit = useCallback((id: number, bytes: number[]) => {
    if (!bytes.length) return; const data = new Uint8Array(bytes), text = new TextDecoder().decode(data);
    if (pausedRef.current) update(id, (s) => ({ ...s, paused: s.paused + data.length })); else append(id, text, 'rx', data);
  }, [append, update]);
  const flush = useCallback((id: number) => { const r = runtimes.current.get(id); if (r?.buffer.length) { const b = r.buffer; r.buffer = []; emit(id, b); } }, [emit]);
  const process = useCallback((id: number, chunk: Uint8Array) => {
    const r = runtimes.current.get(id); if (!r) return; const mode = modeRef.current;
    if (mode === 'raw') return emit(id, [...chunk]); r.buffer.push(...chunk);
    if (mode === 'fixed') { while (r.buffer.length >= lengthRef.current) emit(id, r.buffer.splice(0, lengthRef.current)); return; }
    if (mode === 'idle') { if (r.timer !== null) clearTimeout(r.timer); r.timer = window.setTimeout(() => { r.timer = null; flush(id); }, gapRef.current); return; }
    for (;;) { const at = r.buffer.findIndex((b) => b === 10 || b === 13); if (at < 0) break; const frame = r.buffer.splice(0, at); while (r.buffer[0] === 10 || r.buffer[0] === 13) r.buffer.shift(); if (frame.length) emit(id, frame); }
    // 自动组帧优先使用换行符；没有换行符时，以短暂无数据作为帧结束。
    // 这样既不会受浏览器读取块边界影响，也不会让无行尾设备只显示第一帧。
    if (mode === 'auto' && r.buffer.length) {
      if (r.timer !== null) clearTimeout(r.timer);
      r.timer = window.setTimeout(() => { r.timer = null; flush(id); }, gapRef.current);
    }
  }, [emit, flush]);
  const read = useCallback(async (id: number) => {
    const r = runtimes.current.get(id); if (!r?.port.readable || r.reading) return; r.reading = true; r.buffer = []; const reader = r.port.readable.getReader(); r.reader = reader;
    try { while (r.reading) { const { value, done } = await reader.read(); if (done) break; if (value?.length) { const capture = rawCaptures.current.get(id) ?? { events: [], byteLength: 0, truncated: false }, remaining = COMMUNICATION_CAPTURE_MAX_BYTES - capture.byteLength, captured = value.slice(0, Math.max(0, remaining)); if (captured.length) { capture.events.push({ timestamp: new Date().toISOString(), direction: 'rx', hex: hex([...captured]) }); capture.byteLength += captured.length; } if (captured.length < value.length) capture.truncated = true; rawCaptures.current.set(id, capture); update(id, (s) => ({ ...s, rx: s.rx + value.length, captureBytes: capture.byteLength })); process(id, value); } } }
    catch (e) { if (r.reading) append(id, `读取失败：${e instanceof Error ? e.message : String(e)}`, 'system'); }
    finally { r.reading = false; if (r.reader === reader) r.reader = null; try { reader.releaseLock(); } catch { /* 已释放 */ } }
  }, [append, process, update]);
  const stop = useCallback(async (id: number, close = true) => { const r = runtimes.current.get(id); if (!r) return; r.reading = false; if (r.timer !== null) clearTimeout(r.timer); flush(id); const reader = r.reader; r.reader = null; if (reader) { try { await reader.cancel(); } catch { /* 已断开 */ } try { reader.releaseLock(); } catch { /* 已释放 */ } } if (close) try { await r.port.close(); } catch { /* 已关闭 */ } }, [flush]);

  const addPort = useCallback(async () => {
    const serial = (navigator as Navigator & { serial?: SerialManager }).serial; if (!serial || adding) return; setAdding(true);
    try {
      const port = await serial.requestPort(), duplicate = [...runtimes.current].find(([, r]) => r.port === port);
      if (duplicate) { setActiveId(duplicate[0]); append(duplicate[0], '该串口已在监听列表中', 'system'); return; }
      await port.open({ baudRate: +baud, dataBits: +dataBits, stopBits: +stopBits, parity, flowControl: flow, bufferSize: +bufferSize });
      const id = ++sessionSeq.current, name = portName(port, id), config = `${baud} ${dataBits}${parity === 'none' ? 'N' : parity[0].toUpperCase()}${stopBits}`;
      runtimes.current.set(id, { port, reader: null, reading: false, writing: false, buffer: [], timer: null, lastBytes: 0, lastTime: Date.now() });
      rawCaptures.current.set(id, { events: [], byteLength: 0, truncated: false });
      setSessions((all) => [...all, { id, name, state: 'connected', baud: +baud, config, entries: [], rx: 0, tx: 0, rate: 0, paused: 0, captureBytes: 0 }]); setActiveId(id);
      append(id, `已连接 ${name} · ${config}`, 'system');
      // 串口读取不能依赖可选控制信号。部分 USB 转串口芯片会拒绝 DTR/RTS，
      // 但收发数据本身仍然可用；先启动读取，再将信号失败降级为可见告警。
      void read(id);
      if (port.setSignals) try { await port.setSignals({ dataTerminalReady: dtr, requestToSend: rts }); }
      catch (e) { append(id, `控制信号未应用，串口接收继续运行：${e instanceof Error ? e.message : String(e)}`, 'system'); }
    } catch (e) { const m = e instanceof Error ? e.message : String(e); if (!m.toLowerCase().includes('cancel')) alert(`连接失败：${m}`); }
    finally { setAdding(false); }
  }, [adding, append, baud, bufferSize, dataBits, dtr, flow, parity, read, rts, stopBits]);
  const disconnect = useCallback(async (id: number) => { update(id, (s) => ({ ...s, state: 'disconnecting' })); if (id === activeId) setCycle(false); await stop(id); update(id, (s) => ({ ...s, state: 'disconnected' })); append(id, '连接已断开', 'system'); }, [activeId, append, stop, update]);
  const reconnect = useCallback(async (id: number) => { const r = runtimes.current.get(id); if (!r) return; update(id, (s) => ({ ...s, state: 'connecting' })); try { await r.port.open({ baudRate: +baud, dataBits: +dataBits, stopBits: +stopBits, parity, flowControl: flow, bufferSize: +bufferSize }); update(id, (s) => ({ ...s, state: 'connected', baud: +baud, config: `${baud} ${dataBits}${parity === 'none' ? 'N' : parity[0].toUpperCase()}${stopBits}` })); append(id, `串口已用 ${baud} baud 重新连接`, 'system'); void read(id); } catch (e) { update(id, (s) => ({ ...s, state: 'disconnected' })); append(id, `重新连接失败：${e instanceof Error ? e.message : String(e)}`, 'system'); } }, [append, baud, bufferSize, dataBits, flow, parity, read, stopBits, update]);
  const changeBaud = useCallback(async (value: string) => {
    setBaud(value);
    if (!activeId || active?.state !== 'connected' || active.baud === +value) return;
    const id = activeId, r = runtimes.current.get(id); if (!r) return;
    setCycle(false); update(id, (s) => ({ ...s, state: 'connecting' }));
    await stop(id);
    try {
      await r.port.open({ baudRate: +value, dataBits: +dataBits, stopBits: +stopBits, parity, flowControl: flow, bufferSize: +bufferSize });
      r.lastBytes = active.rx; r.lastTime = Date.now();
      update(id, (s) => ({ ...s, state: 'connected', baud: +value, rate: 0, config: `${value} ${dataBits}${parity === 'none' ? 'N' : parity[0].toUpperCase()}${stopBits}` }));
      append(id, `波特率已切换为 ${value} baud`, 'system'); void read(id);
    } catch (e) {
      update(id, (s) => ({ ...s, state: 'disconnected' }));
      append(id, `切换波特率失败：${e instanceof Error ? e.message : String(e)}`, 'system');
    }
  }, [active, activeId, append, bufferSize, dataBits, flow, parity, read, stop, stopBits, update]);
  const remove = useCallback(async (id: number) => {
    await stop(id); runtimes.current.delete(id); rawCaptures.current.delete(id);
    const next = sessionsRef.current.filter((s) => s.id !== id); setSessions(next);
    setActiveId((current) => current === id ? next[0]?.id ?? null : current);
    if (next.length < 2) { setSplitView(false); setLeftPaneId(null); setRightPaneId(null); return; }
    setLeftPaneId((current) => current === id || !next.some((s) => s.id === current) ? next[0].id : current);
    setRightPaneId((current) => current === id || !next.some((s) => s.id === current) ? next.find((s) => s.id !== (leftPaneId === id ? next[0].id : leftPaneId))?.id ?? next[1].id : current);
  }, [leftPaneId, stop]);
  const send = useCallback(async (id: number, value: string, asHex: boolean) => { const r = runtimes.current.get(id); if (!r?.port.writable || r.writing) return false; try { const text = escapes && !asHex ? unescapeText(value) : value; const data = asHex ? parseHex(value) : new TextEncoder().encode(text + lineEnding); r.writing = true; const writer = r.port.writable.getWriter(); try { await writer.write(data); } finally { writer.releaseLock(); } update(id, (x) => ({ ...x, tx: x.tx + data.length })); if (localEcho) append(id, value, 'tx', data); return true; } catch (e) { append(id, `发送失败：${e instanceof Error ? e.message : String(e)}`, 'system'); return false; } finally { r.writing = false; } }, [append, escapes, lineEnding, localEcho, update]);
  const targetIds = useCallback(() => broadcast ? sessionsRef.current.filter((s) => s.state === 'connected').map((s) => s.id) : activeId ? [activeId] : [], [activeId, broadcast]);
  const sendInput = useCallback(async () => { if (!input.trim()) return; const results = await Promise.all(targetIds().map((id) => send(id, input, txHex))); if (results.some(Boolean)) setInput(''); }, [input, send, targetIds, txHex]);
  const sendShortcut = useCallback(async (shortcut: Shortcut) => { await Promise.all(targetIds().map((id) => send(id, shortcut.value, shortcut.hex))); }, [send, targetIds]);
  const sendFile = useCallback(async (file: File) => {
    const ids = targetIds(); if (!ids.length) return; setFileProgress(`准备发送 ${file.name}`);
    for (const id of ids) {
      const r = runtimes.current.get(id); if (!r?.port.writable || r.writing) continue;
      r.writing = true; const writer = r.port.writable.getWriter(); let sent = 0;
      try {
        while (sent < file.size) { const data = new Uint8Array(await file.slice(sent, sent + 16384).arrayBuffer()); await writer.write(data); sent += data.length; setFileProgress(`${file.name} · ${Math.round(sent * 100 / Math.max(1, file.size))}%`); }
        update(id, (s) => ({ ...s, tx: s.tx + sent })); append(id, `文件已发送：${file.name}（${sent.toLocaleString()} B）`, 'system');
      } catch (e) { append(id, `文件发送失败：${e instanceof Error ? e.message : String(e)}`, 'system'); }
      finally { writer.releaseLock(); r.writing = false; }
    }
    setFileProgress('');
  }, [append, targetIds, update]);
  const signal = useCallback(async (nextDtr: boolean, nextRts: boolean) => { if (!activeId) return; const r = runtimes.current.get(activeId); try { await r?.port.setSignals?.({ dataTerminalReady: nextDtr, requestToSend: nextRts }); } catch (e) { append(activeId, `控制信号失败：${e instanceof Error ? e.message : String(e)}`, 'system'); } }, [activeId, append]);

  useEffect(() => { if (!cycle || !canSend || !input.trim()) return; const ids = targetIds(), timer = setInterval(() => { for (const id of ids) void send(id, input, txHex); }, Math.max(100, Math.min(60000, +cycleMs || 1000))); return () => clearInterval(timer); }, [canSend, cycle, cycleMs, input, send, targetIds, txHex]);
  useEffect(() => {
    if (!canSend || !cyclingShortcutIds.length) return;
    const timers = shortcuts.filter((item) => cyclingShortcutIds.includes(item.id)).map((item) => window.setInterval(() => void sendShortcut(item), Math.max(100, Math.min(60000, item.intervalMs || 1000))));
    return () => timers.forEach((timer) => window.clearInterval(timer));
  }, [canSend, cyclingShortcutIds, sendShortcut, shortcuts]);
  useEffect(() => { const timer = setInterval(() => { const t = Date.now(); setSessions((all) => all.map((s) => { const r = runtimes.current.get(s.id); if (!r || s.state !== 'connected') return s.rate ? { ...s, rate: 0 } : s; const rate = Math.round((s.rx - r.lastBytes) * 1000 / Math.max(1, t - r.lastTime)); r.lastBytes = s.rx; r.lastTime = t; return { ...s, rate }; })); }, 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (autoScroll && !paused && output.current) output.current.scrollTop = output.current.scrollHeight; }, [leftPane?.entries, autoScroll, paused]);
  useEffect(() => { if (autoScroll && !paused && secondaryOutput.current) secondaryOutput.current.scrollTop = secondaryOutput.current.scrollHeight; }, [rightPane?.entries, autoScroll, paused]);
  useEffect(() => { if (!supported) return; const serial = (navigator as Navigator & { serial?: SerialManager }).serial; if (!serial) return; const gone = (e: Event) => { const hit = [...runtimes.current].find(([, r]) => r.port === e.target); if (hit) { append(hit[0], '设备已从系统移除', 'system'); void stop(hit[0], false).then(() => update(hit[0], (s) => ({ ...s, state: 'disconnected' }))); } }; serial.addEventListener('disconnect', gone); return () => serial.removeEventListener('disconnect', gone); }, [append, stop, supported, update]);
  useEffect(() => () => { for (const r of runtimes.current.values()) { r.reading = false; if (r.reader) void r.reader.cancel().catch(() => {}); void r.port.close().catch(() => {}); } }, []);

  const leftDisplayHex = splitView ? leftRxHex : rxHex;
  const rightDisplayHex = splitView ? rightRxHex : rxHex;
  const activeDisplayHex = splitView ? activeId === rightPaneId ? rightRxHex : leftRxHex : rxHex;
  const shown = useMemo(() => visibleEntries(leftPane, filter, leftDisplayHex, showRx, showTx), [filter, leftDisplayHex, leftPane, showRx, showTx]);
  const secondaryShown = useMemo(() => visibleEntries(rightPane, filter, rightDisplayHex, showRx, showTx), [filter, rightDisplayHex, rightPane, showRx, showTx]);
  const save = (format: 'txt' | 'csv') => { if (!active?.entries.length) return; const content = format === 'csv' ? ['timestamp,port,direction,length,data', ...active.entries.map((e) => [e.timestamp, `"${active.name}"`, e.direction, e.bytes?.length ?? new TextEncoder().encode(e.text).length, `"${(e.bytes ? hex(e.bytes) : e.text).replace(/"/g, '""')}"`].join(','))].join('\n') : active.entries.map((e) => `[${e.timestamp}] [${active.name}] [${e.direction.toUpperCase()}] ${e.bytes && activeDisplayHex ? hex(e.bytes) : e.text}`).join('\n'); const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `serial-${active.id}.${format}`; a.click(); URL.revokeObjectURL(url); };
  const saveRaw = () => { if (!active) return; const bytes = active.entries.filter((e) => e.direction === 'rx' && e.bytes).flatMap((e) => e.bytes!); if (!bytes.length) return; const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' })); const a = document.createElement('a'); a.href = url; a.download = `serial-${active.id}-rx.bin`; a.click(); URL.revokeObjectURL(url); };
  const analyzeRx = () => {
    if (!active) return;
    try {
      const raw = rawCaptures.current.get(active.id);
      const capture = createCommunicationCapture({ transport: 'serial', sessionId: String(active.id), endpoint: `${active.name} · ${active.config || `${active.baud} baud`}`, events: raw?.events ?? [] });
      if (raw?.truncated) capture.truncated = true;
      writePendingCommunicationCapture(capture); window.location.hash = '/toolbox/frame';
    } catch (reason) { append(active.id, reason instanceof Error ? reason.message : String(reason), 'system'); }
  };
  const clearActiveLog = () => { if (!activeId) return; rawCaptures.current.set(activeId, { events: [], byteLength: 0, truncated: false }); update(activeId, (session) => ({ ...session, entries: [], paused: 0, captureBytes: 0 })); };
  const addShortcut = () => { if (!input.trim() || shortcuts.length >= shortcutLimit) return; setShortcuts((all) => [...all, { id: Date.now(), name: shortcutName.trim() || input.slice(0, 16), value: input, hex: txHex, intervalMs: 1000 }]); setShortcutName(''); };
  const saveShortcutEdit = () => { if (!editingShortcut?.name.trim() || !editingShortcut.value.trim()) return; setShortcuts((all) => all.map((item) => item.id === editingShortcut.id ? { ...editingShortcut, name: editingShortcut.name.trim(), intervalMs: Math.max(100, Math.min(60000, editingShortcut.intervalMs || 1000)) } : item)); setEditingShortcut(null); };
  const renameSession = (session: Session) => { const value = window.prompt('设置端口名称，例如 COM3', session.name); if (value?.trim()) update(session.id, (item) => ({ ...item, name: value.trim() })); };
  const activateSession = (session: Session) => { setActiveId(session.id); setBaud(String(session.baud)); setCycle(false); };
  const toggleSplitView = () => {
    if (splitView) { setSplitView(false); return; }
    if (sessions.length < 2) return;
    const left = active ?? sessions[0], right = sessions.find((s) => s.id !== left.id) ?? sessions[1];
    setLeftPaneId(left.id); setRightPaneId(right.id); setSplitView(true);
  };
  const selectPane = (side: 'left' | 'right', id: number) => {
    const session = sessions.find((s) => s.id === id); if (!session) return;
    if (side === 'left') { if (rightPaneId === id) setRightPaneId(leftPaneId); setLeftPaneId(id); }
    else { if (leftPaneId === id) setLeftPaneId(rightPaneId); setRightPaneId(id); }
    activateSession(session);
  };
  const chooseSession = (session: Session) => { if (!splitView) activateSession(session); else selectPane(activeId === rightPaneId ? 'right' : 'left', session.id); };
  const renderLogPane = (session: Session | null, entries: Entry[], side: 'left' | 'right', displayHex: boolean) => <div onClick={() => session && activateSession(session)} className={`flex min-h-0 min-w-0 flex-col overflow-hidden border ${session?.id === activeId ? 'border-blue-500/70 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)]' : 'border-transparent'} ${splitView && side === 'right' ? 'lg:border-l-[#30363d]' : ''}`}>
    {splitView && <div className={`flex shrink-0 items-center gap-2 border-b px-2.5 py-1.5 ${session?.id === activeId ? 'border-blue-500/40 bg-blue-500/10' : 'border-[#30363d] bg-[#0b1016]'}`}>
      <i className={`h-1.5 w-1.5 shrink-0 rounded-full ${session?.state === 'connected' ? 'bg-green-400' : 'bg-gray-600'}`} />
      <select aria-label={`${side === 'left' ? '左侧' : '右侧'}日志串口`} value={session?.id ?? ''} onChange={(e) => selectPane(side, Number(e.target.value))} className="min-w-0 max-w-52 flex-1 truncate rounded border border-[#30363d] bg-[#161b22] px-2 py-1 text-[11px] text-gray-200 outline-none focus:border-blue-500">{sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <span className="hidden text-[10px] text-gray-600 xl:inline">RX {session?.rx.toLocaleString() ?? 0} · TX {session?.tx.toLocaleString() ?? 0}</span>
      <label className="ml-auto flex shrink-0 items-center gap-1 text-[10px] text-gray-400"><input aria-label={`${side === 'left' ? '左侧' : '右侧'}窗口 HEX`} type="checkbox" checked={displayHex} onChange={(event) => side === 'left' ? setLeftRxHex(event.target.checked) : setRightRxHex(event.target.checked)} />HEX</label>
      {session?.id === activeId && <span className="shrink-0 rounded bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-medium text-blue-300">发送目标</span>}
    </div>}
    <div ref={side === 'left' ? output : secondaryOutput} data-testid={`browser-serial-terminal-${side}`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#090d12] px-3 py-3 font-mono text-[12px] leading-5 scrollbar-thin lg:px-4 lg:text-[13px]">{paused && session && <div className="sticky top-0 z-10 mb-2 rounded border border-yellow-500/20 bg-[#2a2312] p-2 text-xs text-yellow-300">终端暂停显示；串口仍在接收。已跳过 {session.paused} 字节。</div>}{entries.map((e) => { const alert = /\b(error|fail|fault)\b|错误|失败/i.test(e.text), warning = /\b(warn|warning)\b|警告/i.test(e.text), success = /\b(ok|success|ready)\b|成功|就绪/i.test(e.text); return <div key={e.id} className="serial-terminal-row flex gap-2 rounded px-1"><span className="shrink-0 text-gray-700">{timestamps && e.timestamp}</span><span className={`w-7 shrink-0 text-[10px] font-semibold ${e.direction === 'rx' ? 'text-green-500' : e.direction === 'tx' ? 'text-blue-400' : 'text-yellow-500'}`}>{e.direction === 'system' ? 'SYS' : e.direction.toUpperCase()}</span><span className={`break-all whitespace-pre-wrap ${alert ? 'text-red-400' : warning ? 'text-yellow-300' : success ? 'text-green-300' : 'text-gray-300'}`}>{displayHex && e.bytes ? hex(e.bytes) : e.text}</span></div>; })}</div>
  </div>;

  if (!supported) return <div className="h-full p-6"><div className="mx-auto max-w-4xl rounded-xl border border-yellow-500/30 bg-[#161b22] p-8 text-center"><WifiOff size={48} className="mx-auto mb-4 text-yellow-400" /><h1 className="text-xl text-yellow-300">当前浏览器不支持 Web Serial</h1><p className="mt-2 text-gray-400">请通过 HTTPS 或 localhost 使用桌面版 Chrome / Edge。</p></div></div>;
  return <div className="serial-page h-full overflow-hidden px-3 pb-3 pt-2 lg:px-4 lg:pb-4"><div className="mx-auto flex h-full min-h-0 max-w-[1600px] flex-col">
    <div className="flex min-h-0 flex-1 flex-col">
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#30363d] bg-[#0d1117] shadow-2xl shadow-black/20">
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_220px] lg:grid-rows-1">
      <div className="flex min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-[#30363d] bg-[#0b1016] px-3 py-2"><Search size={13} className="text-gray-600" /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={splitView ? '同时搜索左右日志…' : '搜索当前会话的接收与发送内容…'} className="flex-1 bg-transparent text-xs text-gray-300 outline-none placeholder:text-gray-700" />{filter && <button onClick={() => setFilter('')} className="text-gray-600 hover:text-white"><X size={12} /></button>}<span className="rounded bg-[#161b22] px-2 py-0.5 text-[10px] text-gray-600">{shown.length + secondaryShown.length}/{(leftPane?.entries.length ?? 0) + (rightPane?.entries.length ?? 0)}</span></div>
      <div className={`grid min-h-0 flex-1 ${splitView ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>{renderLogPane(leftPane, shown, 'left', leftDisplayHex)}{splitView && renderLogPane(rightPane, secondaryShown, 'right', rightDisplayHex)}</div>
      </div>
      <aside className="max-h-36 min-h-0 overflow-y-auto border-t border-[#30363d] bg-[#0d1117] p-2 scrollbar-thin lg:max-h-none lg:border-t-0 lg:border-l">
        <div className="mb-2 flex items-center justify-between gap-2 px-1"><span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">快捷命令 <small className="ml-1 font-normal text-gray-700">{shortcuts.length} 条</small></span><label className="flex items-center gap-1.5 text-[10px] text-gray-500"><span>数量上限</span><input type="number" min="1" max="100" value={shortcutLimit} onChange={(e) => setShortcutLimit(Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 1))))} className="h-7 w-16 rounded-md border border-[#30363d] bg-[#161b22] px-2 text-center text-xs text-gray-300 outline-none focus:border-blue-500" title="快捷命令数量上限" /></label></div>
        <div className="space-y-1">{shortcuts.map((item) => { const cycling = cyclingShortcutIds.includes(item.id); return <div key={item.id} className={`flex overflow-hidden rounded-md border bg-[#111820] ${cycling ? 'border-green-500/50' : editingShortcut?.id === item.id ? 'border-blue-500/60' : 'border-[#30363d]'}`}><button onClick={() => void sendShortcut(item)} disabled={!canSend} className="min-w-0 flex-1 truncate px-2.5 py-1.5 text-left text-xs text-gray-300 hover:bg-blue-500/10 disabled:opacity-40">{item.name}{item.hex && <small className="ml-1 text-purple-400">HEX</small>}{cycling && <small className="ml-1 text-green-400">{item.intervalMs || 1000}ms</small>}</button><button onClick={() => setCyclingShortcutIds((ids) => cycling ? ids.filter((id) => id !== item.id) : [...ids, item.id])} disabled={!canSend && !cycling} className={`border-l border-[#30363d] px-2 disabled:opacity-40 ${cycling ? 'bg-green-500/10 text-green-400' : 'text-gray-600 hover:text-green-400'}`} title={cycling ? '停止周期发送' : `每 ${item.intervalMs || 1000}ms 周期发送`}><Clock3 size={10} /></button><button onClick={() => setEditingShortcut({ ...item, intervalMs: item.intervalMs || 1000 })} className="border-l border-[#30363d] px-2 text-gray-600 hover:text-blue-400" title="编辑"><Pencil size={10} /></button><button onClick={() => { setShortcuts((all) => all.filter((x) => x.id !== item.id)); setCyclingShortcutIds((ids) => ids.filter((id) => id !== item.id)); if (editingShortcut?.id === item.id) setEditingShortcut(null); }} className="border-l border-[#30363d] px-2 text-gray-600 hover:text-red-400" title="删除"><X size={10} /></button></div>; })}</div>
      {editingShortcut && <div className="mt-2 grid gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-2"><input value={editingShortcut.name} onChange={(e) => setEditingShortcut((item) => item ? { ...item, name: e.target.value } : item)} placeholder="命令名称" className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-xs outline-none focus:border-blue-500" /><input value={editingShortcut.value} onChange={(e) => setEditingShortcut((item) => item ? { ...item, value: e.target.value } : item)} placeholder="发送内容" className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 font-mono text-xs outline-none focus:border-blue-500" /><label className="flex items-center gap-1 text-xs text-gray-400"><input type="number" min="100" max="60000" step="100" value={editingShortcut.intervalMs || 1000} onChange={(e) => setEditingShortcut((item) => item ? { ...item, intervalMs: Number(e.target.value) } : item)} className="w-20 rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 outline-none" />ms</label><label className="flex items-center gap-1 text-xs text-gray-400"><input type="checkbox" checked={editingShortcut.hex} onChange={(e) => setEditingShortcut((item) => item ? { ...item, hex: e.target.checked } : item)} />HEX</label><div className="flex gap-1"><button onClick={saveShortcutEdit} disabled={!editingShortcut.name.trim() || !editingShortcut.value.trim()} className="flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1.5 text-xs text-white disabled:opacity-40"><Check size={12} />保存</button><button onClick={() => setEditingShortcut(null)} className="rounded border border-[#30363d] px-2.5 py-1.5 text-xs text-gray-400">取消</button></div></div>}
      </aside>
      </div>
      <div className="shrink-0 border-t border-[#30363d] bg-[#0b1016] px-3 py-3">
        <div className="mb-2 flex min-h-7 flex-wrap items-center gap-3 border-b border-[#30363d] pb-2 text-xs"><b className="text-gray-300">{active?.name ?? '未选择串口'}</b><span className={connected ? 'text-green-400' : 'text-gray-500'}>{connected ? '● 在线' : '● 离线'}</span><span className="text-gray-500">RX {(active?.rx ?? 0).toLocaleString()} B</span><span className="text-gray-500">TX {(active?.tx ?? 0).toLocaleString()} B</span><span className="text-gray-500">{active?.rate ?? 0} B/s</span><div className="ml-auto flex flex-wrap items-center gap-2 text-gray-400"><label><input type="checkbox" checked={showRx} onChange={(e) => setShowRx(e.target.checked)} /> RX</label><label><input type="checkbox" checked={showTx} onChange={(e) => setShowTx(e.target.checked)} /> TX</label>{!splitView && <label><input type="checkbox" checked={rxHex} onChange={(e) => setRxHex(e.target.checked)} /> HEX</label>}<label><input type="checkbox" checked={timestamps} onChange={(e) => setTimestamps(e.target.checked)} /> 时间戳</label><label><input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} /> 跟随</label><button onClick={() => { setPaused((v) => !v); if (activeId) update(activeId, (s) => ({ ...s, paused: 0 })); }} title={paused ? '继续显示' : '暂停显示'}>{paused ? <Play size={14} /> : <Pause size={14} />}</button><button onClick={analyzeRx} disabled={!active?.captureBytes} title="将当前会话 RX 原始数据送入协议工作台" aria-label="用协议工作台解析 RX"><Braces size={14} /></button><button onClick={clearActiveLog} title="清空"><Trash2 size={14} /></button><button onClick={() => save('txt')} title="文本日志"><Download size={14} /></button><button onClick={() => save('csv')}>CSV</button><button onClick={saveRaw}>RAW</button></div></div>
        {showSettings && <div className="serial-settings mb-3 grid grid-cols-2 gap-3 border-b border-[#30363d] pb-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11">
          <label className="text-xs text-gray-500">数据位<select value={dataBits} onChange={(e) => setDataBits(e.target.value)} className="field"><option>7</option><option>8</option></select></label><label className="text-xs text-gray-500">停止位<select value={stopBits} onChange={(e) => setStopBits(e.target.value)} className="field"><option>1</option><option>2</option></select></label><label className="text-xs text-gray-500">校验<select value={parity} onChange={(e) => setParity(e.target.value as Parity)} className="field"><option value="none">None</option><option value="even">Even</option><option value="odd">Odd</option></select></label><label className="text-xs text-gray-500">流控<select value={flow} onChange={(e) => setFlow(e.target.value as FlowControl)} className="field"><option value="none">None</option><option value="hardware">RTS/CTS</option></select></label><label className="text-xs text-gray-500">接收缓冲<select value={bufferSize} onChange={(e) => setBufferSize(e.target.value)} className="field"><option value="4096">4 KB</option><option value="16384">16 KB</option><option value="65536">64 KB</option><option value="262144">256 KB</option></select></label><label className="text-xs text-gray-500">发送行尾<select value={lineEnding} onChange={(e) => setLineEnding(e.target.value)} className="field"><option value="\n">NL</option><option value="\r\n">CRLF</option><option value="\r">CR</option><option value="">None</option></select></label>
          <label className="text-xs text-gray-500">DTR<button onClick={() => { const n = !dtr; setDtr(n); void signal(n, rts); }} className="field">{dtr ? 'ON' : 'OFF'}</button></label><label className="text-xs text-gray-500">RTS<button onClick={() => { const n = !rts; setRts(n); void signal(dtr, n); }} className="field">{rts ? 'ON' : 'OFF'}</button></label><label className="text-xs text-gray-500">组帧<select value={frameMode} onChange={(e) => setFrameMode(e.target.value as FrameMode)} className="field"><option value="auto">自动（推荐）</option><option value="line">换行符</option><option value="idle">空闲间隔</option><option value="fixed">固定长度</option><option value="raw">原始读取块</option></select></label><label className="text-xs text-gray-500">间隔 ms<input type="number" value={frameGap} disabled={frameMode !== 'idle' && frameMode !== 'auto'} onChange={(e) => setFrameGap(e.target.value)} className="field" /></label><label className="text-xs text-gray-500">长度 Byte<input type="number" value={frameLength} disabled={frameMode !== 'fixed'} onChange={(e) => setFrameLength(e.target.value)} className="field" /></label>
        </div>}
        <div className="grid gap-3 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="min-w-0 lg:border-r lg:border-[#30363d] lg:pr-3"><div className="mb-2 flex min-h-8 gap-1.5 overflow-x-auto scrollbar-thin">{sessions.map((s) => <div key={s.id} className={`flex shrink-0 overflow-hidden rounded-md border ${activeId === s.id ? 'border-blue-500/60 bg-blue-500/10' : 'border-[#30363d] bg-[#161b22]'}`}><button onClick={() => chooseSession(s)} className="flex items-center gap-1.5 px-2 py-1 text-left"><i className={`h-1.5 w-1.5 rounded-full ${s.state === 'connected' ? 'bg-green-400' : 'bg-gray-600'}`} /><span><b className="block max-w-28 truncate text-[11px] font-medium text-gray-200">{s.name}</b><small className="block max-w-28 truncate text-[8px] text-gray-600">{s.config || '未连接'}</small></span></button><button onClick={() => renameSession(s)} className="border-l border-[#30363d] px-1.5 text-gray-600 hover:text-blue-400" title="重命名"><Pencil size={10} /></button><button onClick={() => void remove(s.id)} className="border-l border-[#30363d] px-1.5 text-gray-600 hover:text-red-400" title="关闭"><X size={10} /></button></div>)}</div><div className="flex items-end gap-2"><label className="min-w-0 flex-1 text-[11px] text-gray-500">波特率<select value={baud} onChange={(e) => void changeBaud(e.target.value)} disabled={active?.state === 'connecting' || active?.state === 'disconnecting'} className="mt-1 block w-full rounded-lg border border-[#30363d] bg-[#161b22] px-2 py-2 text-xs text-white disabled:opacity-50">{[1200,2400,4800,9600,19200,38400,57600,115200,230400,460800,921600,1000000,2000000].map((v) => <option key={v}>{v}</option>)}</select></label><button onClick={() => void addPort()} disabled={adding} className="flex h-[34px] items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"><Plus size={14} />{adding ? '连接中' : '添加'}</button>{active && (connected ? <button onClick={() => void disconnect(active.id)} className="flex h-[34px] items-center gap-1 rounded-lg border border-red-500/30 px-2 text-xs text-red-400"><Square size={10} />断开</button> : <button onClick={() => void reconnect(active.id)} className="flex h-[34px] items-center gap-1 rounded-lg border border-green-500/30 px-2 text-xs text-green-400"><Wifi size={11} />重连</button>)}<button onClick={toggleSplitView} disabled={sessions.length < 2} className={`flex h-[34px] shrink-0 items-center justify-center rounded-lg border px-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-35 ${splitView ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' : 'border-[#30363d] text-gray-400'}`} title={sessions.length < 2 ? '连接两个串口后可对照查看' : splitView ? '切换为单窗口' : '左右对照两个串口日志'}>{splitView ? '单窗口' : '双窗口'}</button><button onClick={() => setShowSettings((v) => !v)} className={`flex h-[34px] items-center justify-center rounded-lg border px-2 ${showSettings ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' : 'border-[#30363d] text-gray-400'}`} title="串口参数"><Settings size={14} /></button></div></div>
        <div>
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
          <span className={`rounded-md border px-2 py-1 ${broadcast ? 'border-orange-500/30 bg-orange-500/10 text-orange-300' : 'border-blue-500/25 bg-blue-500/10 text-blue-300'}`}>发送到：{broadcast ? `${onlineCount} 个在线串口` : active?.name ?? '未选择'}</span>
          <label className="flex items-center gap-1"><input type="checkbox" checked={txHex} onChange={(e) => setTxHex(e.target.checked)} />发送 HEX</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={escapes} disabled={txHex} onChange={(e) => setEscapes(e.target.checked)} />解析转义符</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={localEcho} onChange={(e) => setLocalEcho(e.target.checked)} />本地回显</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={cycle} disabled={!canSend || !input.trim()} onChange={(e) => setCycle(e.target.checked)} />循环发送</label>
          <label className="flex items-center gap-1"><input className="w-20 rounded border border-[#30363d] bg-[#161b22] px-2 py-1" type="number" min="100" value={cycleMs} onChange={(e) => setCycleMs(e.target.value)} />ms</label>
          <label className={`flex items-center gap-1 rounded-md px-2 py-1 ${broadcast ? 'bg-orange-500/15 text-orange-300' : ''}`}><input type="checkbox" checked={broadcast} onChange={(e) => setBroadcast(e.target.checked)} /><Radio size={11} />广播到全部在线串口</label>
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-md border border-[#30363d] bg-[#161b22] px-2.5 py-1.5 hover:border-[#484f58] hover:text-white"><FileUp size={12} />{fileProgress || '发送文件'}<input type="file" className="hidden" disabled={!canSend || Boolean(fileProgress)} onChange={(e) => { const file = e.target.files?.[0]; if (file) void sendFile(file); e.target.value = ''; }} /></label>
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={shortcutName} onChange={(e) => setShortcutName(e.target.value)} placeholder="快捷命令名称" className="w-32 rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-2 text-xs outline-none placeholder:text-gray-700" />
          <input value={input} disabled={!canSend} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void sendInput(); }} placeholder={txHex ? 'HEX：DE AD BE EF' : escapes ? '支持 \\r \\n \\t \\xFF \\u4E2D' : broadcast ? '发送到全部在线串口' : '发送到当前串口，Enter 发送'} className="min-w-52 flex-1 rounded-lg border border-[#30363d] bg-[#161b22] px-4 py-2 text-sm outline-none placeholder:text-gray-700 focus:border-blue-500 disabled:opacity-50" />
          <button onClick={addShortcut} disabled={!input.trim() || shortcuts.length >= shortcutLimit} title={shortcuts.length >= shortcutLimit ? `已达到 ${shortcutLimit} 条上限` : '保存为快捷命令'} className="rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-2 text-xs text-gray-300 hover:border-[#484f58] disabled:opacity-40"><Plus size={13} className="inline" /> 保存快捷命令</button>
          <button onClick={() => void sendInput()} disabled={!canSend || !input.trim()} className={`flex min-w-24 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-40 ${broadcast ? 'bg-orange-600 hover:bg-orange-500' : 'bg-blue-600 hover:bg-blue-500'}`}><Send size={14} />{broadcast ? '广播' : '发送'}</button>
        </div>
        </div>
        </div>
      </div>
    </section>
    </div>
  </div></div>;
}
