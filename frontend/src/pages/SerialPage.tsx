import { useState, useRef, useEffect } from 'react';
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

const mockPorts = [
  { path: '/dev/ttyUSB0', name: 'Arduino Uno', baud: 9600 },
  { path: '/dev/ttyACM0', name: 'STM32 Virtual COM', baud: 115200 },
  { path: '/dev/ttyUSB1', name: 'ESP32-DevKit', baud: 115200 },
];

export default function SerialPage() {
  const [connected, setConnected] = useState(false);
  const [selectedPort, setSelectedPort] = useState('');
  const [baudRate, setBaudRate] = useState('115200');
  const [output, setOutput] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleConnect = () => {
    if (connected) {
      setConnected(false);
      setOutput((prev) => [...prev, `\n[ disconnected from ${selectedPort} ]`]);
    } else {
      setConnected(true);
      setOutput((prev) => [
        ...prev,
        `[ connected to ${selectedPort} at ${baudRate} baud ]`,
      ]);
    }
  };

  const handleSend = () => {
    if (!input.trim() || !connected) return;
    setOutput((prev) => [...prev, `> ${input}`]);
    setInput('');
    // Simulate response
    setTimeout(() => {
      setOutput((prev) => [...prev, `[echo] ${input}`]);
    }, 200);
  };

  const handleClear = () => setOutput([]);
  const handleSave = () => {
    const blob = new Blob([output.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'serial_output.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

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

        {/* Connection Settings */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 mb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">端口</label>
              <select
                value={selectedPort}
                onChange={(e) => setSelectedPort(e.target.value)}
                disabled={connected}
                className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-white
                  focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer"
              >
                <option value="">选择端口</option>
                {mockPorts.map((p) => (
                  <option key={p.path} value={p.path}>{p.name} ({p.path})</option>
                ))}
              </select>
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
                {[9600, 19200, 38400, 57600, 115200].map((b) => (
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
              {connected ? <><Square size={14} fill="currentColor" /> 断开</> : <><Wifi size={14} /> 连接</>}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-400 hover:text-white"
            >
              <Settings size={18} />
            </button>
          </div>

          {showSettings && (
            <div className="mt-4 pt-4 border-t border-[#30363d] grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">数据位</label>
                <select className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-sm text-white cursor-pointer">
                  <option>8</option>
                  <option>7</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">停止位</label>
                <select className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-sm text-white cursor-pointer">
                  <option>1</option>
                  <option>2</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">校验位</label>
                <select className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-sm text-white cursor-pointer">
                  <option>None</option>
                  <option>Even</option>
                  <option>Odd</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">流控制</label>
                <select className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-sm text-white cursor-pointer">
                  <option>None</option>
                  <option>RTS/CTS</option>
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

          {/* Output */}
          <div
            ref={outputRef}
            className="flex-1 p-4 font-mono text-sm text-gray-300 overflow-y-auto scrollbar-thin"
          >
            {output.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-600">
                <div className="text-center">
                  <WifiOff size={32} className="mx-auto mb-2 opacity-50" />
                  <p>选择端口并点击连接开始</p>
                </div>
              </div>
            ) : (
              output.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap">
                  {line.startsWith('>') ? (
                    <span className="text-blue-400">{line}</span>
                  ) : line.startsWith('[') && line.includes(']') ? (
                    <span className="text-gray-500">{line}</span>
                  ) : line.startsWith('[echo]') ? (
                    <span className="text-green-400">{line}</span>
                  ) : (
                    <span>{line}</span>
                  )}
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
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="输入数据并回车发送..."
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
