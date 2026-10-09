import { useState } from 'react';
import { LockKeyhole, Radio, Server, Wifi } from 'lucide-react';
import AgentSerialDebugger from '../features/communication/AgentSerialDebugger';
import AgentNetworkDebugger from '../features/communication/AgentNetworkDebugger';
import WebSocketDebugger from '../features/communication/WebSocketDebugger';

export default function CommunicationPage() {
  type Tab = 'serial' | 'websocket' | 'agent';
  const [tab, setTab] = useState<Tab>(() => {
    const saved = sessionStorage.getItem('embedkit.communication.tab');
    return saved === 'websocket' || saved === 'agent' ? saved : 'serial';
  });
  const selectTab = (next: Tab) => { setTab(next); sessionStorage.setItem('embedkit.communication.tab', next); };
  const tabs = [
    { id: 'serial' as const, label: '串口调试', detail: 'Web Serial · 多会话', icon: Radio, accent: 'blue' },
    { id: 'websocket' as const, label: 'WebSocket', detail: '文本与二进制帧', icon: Wifi, accent: 'green' },
    { id: 'agent' as const, label: 'TCP / UDP', detail: '本机 Agent · 原始套接字', icon: Server, accent: 'purple' },
  ] as const;
  const selectedStyles = { blue: 'border-blue-500/40 bg-blue-500/10 text-blue-300 shadow-blue-950/30', green: 'border-green-500/40 bg-green-500/10 text-green-300 shadow-green-950/30', purple: 'border-purple-500/40 bg-purple-500/10 text-purple-300 shadow-purple-950/30' };
  return <div className="flex h-full min-h-0 flex-col">
    <div className="shrink-0 border-b border-[#30363d]/80 bg-[#111820]/95 px-3 py-3 shadow-lg shadow-black/10 backdrop-blur lg:px-5">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto scrollbar-thin" role="tablist" aria-label="通信调试方式">
          {tabs.map(({ id, label, detail, icon: Icon, accent }) => {
            const active = tab === id;
            return <button key={id} type="button" role="tab" aria-selected={active} onClick={() => selectTab(id)} className={`group flex min-w-fit items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-all sm:min-w-44 ${active ? `${selectedStyles[accent]} shadow-md` : 'border-transparent text-gray-500 hover:border-[#30363d] hover:bg-white/[0.025] hover:text-gray-300'}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-white/10' : 'bg-[#161b22] group-hover:bg-[#202731]'}`}><Icon size={16} /></span>
              <span><b className="block text-xs font-semibold">{label}</b><small className="mt-0.5 hidden text-[10px] text-gray-500 sm:block">{detail}</small></span>
            </button>;
          })}
        </div>
        <div className="hidden shrink-0 items-center gap-2 rounded-lg border border-[#30363d] bg-[#0d1117]/70 px-3 py-2 text-[10px] text-gray-500 xl:flex"><LockKeyhole size={12} className="text-green-500" />连接与日志仅在本机处理</div>
      </div>
    </div>
    <div className="min-h-0 flex-1">{tab === 'serial' ? <AgentSerialDebugger /> : tab === 'websocket' ? <WebSocketDebugger /> : <AgentNetworkDebugger />}</div>
  </div>;
}
