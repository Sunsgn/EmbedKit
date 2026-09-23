import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Terminal,
  Square,
  RefreshCw,
  Settings,
  Wifi,
  WifiOff,
  Download,
  Send,
} from 'lucide-react';

let readController: AbortController | null = null;

interface SerialLine {
  text: string;
  timestamp: string;
  type: 'rx' | 'tx' | 'system';
}

export default function SerialPage() {
  const [connected, setConnected] = useState(false);
  const [portName, setPortName] = useState('未连接');
  const [baudRate, setBaudRate] = useState('115200');
  const [dataBits, setDataBits] = useState('8');
  const [stopBits, setStopBits] = useState('1');
  const [parity, setParity] = useState<'none' | 'even' | 'odd'>('none');
  const [flowControl, setFlowControl] = useState<'none' | 'hardware'>('none');
  const [output, setOutput] = useState<SerialLine[]>([]);
  const [input, setInput] = useState('');
  const [sendHistory, setSendHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showSettings, setShowSettings] = useState(false);
  const [hexMode, setHexMode] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [lineEnding, setLineEnding] = useState('\n');
  const [serialSupported, setSerialSupported] = useState(true);
  const [rxBytes, setRxBytes] = useState(0);
  const [txBytes, setTxBytes] = useState(0);
  const outputRef = useRef<HTMLDivElement>(null);
  const portRef = useRef<any>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serial' in navigator)) {
      setSerialSupported(false);
    }
  }, []);

  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, autoScroll]);

  const getTimestamp = () => {
    const now = new Date();
    return now.toLocaleTimeString('zh-CN', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
  };

  const appendOutput = useCallback((text: string, type: 'rx' | 'tx' | 'system' = 'rx') => {
    setOutput((prev) => [...prev, { text, timestamp: getTimestamp(), type }]);
  }, []);

  const readLoop = useCallback(async (port: any) => {
    if (!port.readable) return;
    readController = new AbortController();
    const reader = port.readable.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
         if (hexMode) {
            const hex = Array.from(value)
              .map((b) => (b as number).toString(16).padStart(2, '0').toUpperCase())
              .join(' ');
            appendOutput(hex, 'rx');
            setRxBytes((prev) => prev + value.length);
          } else {
            buffer += decoder.decode(value, { stream: true });
            setRxBytes((prev) => prev + value.length);
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || '';
            lines.forEach((line) => {
              if (line.length > 0) appendOutput(line, 'rx');
            });
          }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
     appendOutput(`[error] ${e.message}`, 'system');
      }
    } finally {
      reader.releaseLock();
    }
  }, [hexMode, appendOutput]);

  const handleDisconnect = useCallback(async () => {
    if (readController) {
      readController.abort();
      readController = null;
    }
    if (portRef.current) {
      try {
        await portRef.current.close();
      } catch {}
      portRef.current = null;
    }
    setConnected(false);
    setPortName('未连接');
    appendOutput(`\n[ disconnected ]`, 'system');
  }, []);

  const handleConnect = useCallback(async () => {
    if (connected) {
      await handleDisconnect();
      return;
    }
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({
        baudRate: parseInt(baudRate),
        dataBits: parseInt(dataBits),
        stopBits: parseInt(stopBits),
        parity,
        flowControl,
      });
      portRef.current = port;
      setConnected(true);
      setPortName(port.getInfo().productName || 'Serial Port');
       setRxBytes(0);
        setTxBytes(0);
        appendOutput(`\n[ connected at ${baudRate} baud | ${dataBits}${parity.toUpperCase()[0]}${stopBits} | flow:${flowControl} ]`, 'system');
      readLoop(port);
    } catch (e: any) {
      appendOutput(`[error] ${e.message}`, 'system');
    }
  }, [connected, baudRate, dataBits, stopBits, parity, flowControl, handleDisconnect, appendOutput, readLoop]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !connected || !portRef.current?.writable) return;
    const encoder = new TextEncoder();
    let data: Uint8Array;
    if (hexMode) {
      const hexStr = input.replace(/\s+/g, '');
      const bytes = hexStr.match(/.{1,2}/g);
      if (bytes) {
        data = new Uint8Array(bytes.map((b) => parseInt(b, 16)));
      } else {
        return;
      }
    } else {
      data = encoder.encode(input + lineEnding);
    }
    const writer = portRef.current.writable.getWriter();
    writer.write(data).then(() => writer.releaseLock());
    setTxBytes((prev) => prev + data.length);
    setSendHistory((prev) => {
      const filtered = prev.filter((s) => s !== input);
      return [input, ...filtered].slice(0, 50);
    });
    appendOutput(`> ${input}`, 'tx');
    setInput('');
    setHistoryIndex(-1);
  }, [input, connected, hexMode, lineEnding, appendOutput]);

  useEffect(() => {
    return () => {
      if (readController) readController.abort();
      if (portRef.current) portRef.current.close().catch(() => {});
    };
  }, []);

  const handleClear = () => {
    setOutput([]);
    setRxBytes(0);
    setTxBytes(0);
  };
  const handleSave = () => {
    const blob = new Blob([output.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'serial_output.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!serialSupported) {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Terminal size={28} className="text-blue-400" />
              串口调试器
            </h1>
            <p className="text-gray-400">实时串口通信与数据监控</p>
          </div>
          <div className="bg-[#161b22] border border-yellow-500/30 rounded-xl p-8 text-center">
            <WifiOff size={48} className="mx-auto mb-4 text-yellow-400 opacity-60" />
            <h2 className="text-xl font-semibold mb-2 text-yellow-300">浏览器不支持 Web Serial API</h2>
            <p className="text-gray-400 mb-4">
              Web Serial API 目前仅在 Chrome、Edge 等基于 Chromium 的浏览器中支持。
              请切换浏览器或使用 Chrome/Edge 访问。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Terminal size={28} className="text-blue-400" />
            串口调试器
          </h1>
          <p className="text-gray-400">实时串口通信与数据监控 (Web Serial API)</p>
        </div>

        {/* Connection Settings */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 mb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">端口状态</label>
              <div className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-gray-300 min-w-[120px]">
                {portName}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">波特率</label>
              <select
                value={baudRate}
                onChange={(e) => setBaudRate(e.target.value)}
                disabled={connected}
                className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-white
                  focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer"
              >
                {[1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600].map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleConnect}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors
                ${connected
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
                  : 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/30'
                }`}
            >
              {connected ? <><Square size={14} fill="currentColor" /> 断开</> : <><Wifi size={14} /> 选择端口并连接</>}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-400 hover:text-white"
            >
              <Settings size={18} />
            </button>
          </div>

          {showSettings && (
            <div className="mt-4 pt-4 border-t border-[#30363d] grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">数据位</label>
                <select
                  value={dataBits}
                  onChange={(e) => setDataBits(e.target.value)}
                  disabled={connected}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-sm text-white cursor-pointer disabled:opacity-50"
                >
                  <option value="7">7</option>
                  <option value="8">8</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">停止位</label>
                <select
                  value={stopBits}
                  onChange={(e) => setStopBits(e.target.value)}
                  disabled={connected}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-sm text-white cursor-pointer disabled:opacity-50"
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">校验位</label>
                <select
                  value={parity}
                  onChange={(e) => setParity(e.target.value as any)}
                  disabled={connected}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-sm text-white cursor-pointer disabled:opacity-50"
                >
                  <option value="none">None</option>
                  <option value="even">Even</option>
                  <option value="odd">Odd</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">流控制</label>
                <select
                  value={flowControl}
                  onChange={(e) => setFlowControl(e.target.value as any)}
                  disabled={connected}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-sm text-white cursor-pointer disabled:opacity-50"
                >
                  <option value="none">None</option>
                  <option value="hardware">RTS/CTS</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">行尾符</label>
                <select
                  value={lineEnding}
                  onChange={(e) => setLineEnding(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-sm text-white cursor-pointer"
                >
                  <option value="\n">NL (\n)</option>
                  <option value="\r\n">CRLF (\r\n)</option>
                  <option value="\r">CR (\r)</option>
                  <option value="">None</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Terminal */}
        <div className="bg-[#0d1117] border border-[#30363d] rounded-xl overflow-hidden flex flex-col" style={{ height: '500px' }}>
          {/* Terminal Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d]">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-300">串口输出</span>
              {connected && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  已连接
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hexMode}
                  onChange={(e) => setHexMode(e.target.checked)}
                  className="accent-blue-500"
                />
                HEX
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showTimestamps}
                  onChange={(e) => setShowTimestamps(e.target.checked)}
                  className="accent-blue-500"
                />
                时间戳
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="accent-blue-500"
                />
                自动滚动
              </label>
              <button
                onClick={handleClear}
                className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#1c2128]"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={handleSave}
                className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#1c2128]"
              >
                <Download size={14} />
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-[#0d1117] border-b border-[#30363d] text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                {connected ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-400">在线</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-gray-500" />
                    <span>离线</span>
                  </>
                )}
              </span>
              {connected && (
                <>
                  <span>↑ TX: {txBytes.toLocaleString()} B</span>
                  <span>↓ RX: {rxBytes.toLocaleString()} B</span>
                </>
              )}
            </div>
            <span>{output.length} 条消息</span>
          </div>

          {/* Output */}
          <div
            ref={outputRef}
            className="flex-1 p-4 font-mono text-sm text-gray-300 overflow-y-auto scrollbar-thin"
          >
            {output.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-600">
                <div className="text-center">
                  <WifiOff size={32} className="mx-auto mb-2 opacity-50" />
                  <p>点击"选择端口并连接"开始串口通信</p>
                </div>
              </div>
            ) : (
              output.map((line, i) => (
                <div key={i} className="flex gap-2">
                  {showTimestamps && (
                    <span className="text-gray-600 select-none shrink-0">{line.timestamp}</span>
                  )}
                  <span className="whitespace-pre-wrap">
                    {line.type === 'tx' ? (
                      <span className="text-blue-400">{line.text}</span>
                    ) : line.type === 'system' ? (
                      <span className="text-gray-500">{line.text}</span>
                    ) : (
                      <span>{line.text}</span>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="border-t border-[#30363d] p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setHistoryIndex(-1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSend();
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (sendHistory.length > 0) {
                      const newIndex = historyIndex === -1 ? 0 : Math.min(historyIndex + 1, sendHistory.length - 1);
                      setHistoryIndex(newIndex);
                      setInput(sendHistory[newIndex]);
                    }
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (historyIndex > 0) {
                      const newIndex = historyIndex - 1;
                      setHistoryIndex(newIndex);
                      setInput(sendHistory[newIndex]);
                    } else {
                      setHistoryIndex(-1);
                      setInput('');
                    }
                  }
                }}
                placeholder={hexMode ? '输入HEX数据 (e.g. DE AD BE EF)...' : '输入数据并回车发送 (↑/↓ 历史)...'}
                disabled={!connected}
                className="flex-1 bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-2 text-sm
                  text-white placeholder-gray-500 focus:outline-none focus:border-blue-500
                  disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!connected}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg
                  hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={14} />
                发送
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
