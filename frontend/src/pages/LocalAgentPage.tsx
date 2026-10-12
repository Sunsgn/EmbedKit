import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Download, ExternalLink, RefreshCw, Server, ShieldCheck, TriangleAlert, WifiOff } from 'lucide-react';
import { AgentClientError, AGENT_PROTOCOL_VERSION, getAgentStatus, type AgentStatus } from '../services/agentClient';
import { LOCAL_PROXY_BASE } from '../services/aiService';

type AgentState = 'checking' | 'online' | 'offline' | 'incompatible' | 'error';
const RELEASES_URL = 'https://github.com/sunsgn/EmbedKit/releases/latest';
const publicAgentEndpoint = (() => { try { const url = new URL(LOCAL_PROXY_BASE); url.username = ''; url.password = ''; url.search = ''; url.hash = ''; return url.toString().replace(/\/$/, ''); } catch { return '本机自定义地址'; } })();
const capabilityLabels: Record<string, string> = {
  serial: '真实串口', 'tcp-client': 'TCP 客户端', 'tcp-server': 'TCP 服务端', udp: 'UDP', 'udp-server': 'UDP 服务端', websocket: 'WebSocket',
  'local-picker': '系统文件/目录选择', 'file-read': '受控文件读取', 'elf-analysis': 'ELF / DWARF', 'project-build': '工程识别与可选构建',
};

function saveJson(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}

export default function LocalAgentPage() {
  const [state, setState] = useState<AgentState>('checking'), [status, setStatus] = useState<AgentStatus | null>(null), [detail, setDetail] = useState('');
  const detect = useCallback(async () => {
    setState('checking'); setDetail('');
    try { setStatus(await getAgentStatus()); setState('online'); }
    catch (reason) {
      setStatus(null);
      if (reason instanceof AgentClientError && reason.kind === 'incompatible') setState('incompatible');
      else if (reason instanceof AgentClientError && (reason.kind === 'offline' || reason.kind === 'timeout')) setState('offline');
      else setState('error');
      setDetail(reason instanceof Error ? reason.message : String(reason));
    }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void detect(), 0); return () => clearTimeout(timer); }, [detect]);

  const exportDiagnostics = () => saveJson('embedkit-agent-diagnostics.json', {
    schema: 'embedkit.agent-diagnostics', version: 1, checkedAt: new Date().toISOString(), webProtocolVersion: AGENT_PROTOCOL_VERSION,
    endpoint: publicAgentEndpoint, state, agent: status ? { ...status, capabilities: [...status.capabilities].sort() } : null,
    note: detail || undefined,
  });

  return <div className="h-full overflow-y-auto p-5 scrollbar-thin lg:p-8"><div className="mx-auto max-w-5xl space-y-5">
    <header><p className="text-xs font-medium text-blue-400">LOCAL CAPABILITY BRIDGE</p><h1 className="mt-1 text-2xl font-bold">本地助手</h1><p className="mt-2 text-sm text-gray-500">网页工具可独立使用；真实串口、本地文件、ELF 和工程工具链等能力由只监听本机回环地址的 Agent 增强。</p></header>
    <section className={`rounded-xl border p-5 ${state === 'online' ? 'border-green-500/25 bg-green-500/5' : state === 'checking' ? 'border-blue-500/25 bg-blue-500/5' : 'border-yellow-500/25 bg-yellow-500/5'}`}>
      <div className="flex flex-wrap items-center gap-3">{state === 'online' ? <CheckCircle2 className="text-green-400" /> : state === 'checking' ? <RefreshCw className="animate-spin text-blue-400" /> : <WifiOff className="text-yellow-400" />}<div className="min-w-0 flex-1"><b className="block">{state === 'online' ? `已连接 ${status?.name}` : state === 'checking' ? '正在检测本地助手…' : state === 'incompatible' ? '检测到不兼容版本' : '本地助手未连接'}</b><span className="mt-1 block break-all text-xs text-gray-500">{state === 'online' && status ? `Agent v${status.version} · 协议 ${status.protocolVersion} · ${status.capabilities.length} 项能力` : detail || `检测地址：${publicAgentEndpoint}`}</span></div><button onClick={() => void detect()} disabled={state === 'checking'} className="inline-flex items-center gap-1 rounded border border-[#30363d] px-3 py-2 text-xs text-gray-300 disabled:opacity-40"><RefreshCw size={13} />重新检测</button><button onClick={exportDiagnostics} className="inline-flex items-center gap-1 rounded border border-[#30363d] px-3 py-2 text-xs text-gray-300"><Download size={13} />导出诊断</button></div>
      {status && <div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="rounded bg-[#0d1117] p-3 text-xs"><span className="text-gray-600">串口会话</span><b className="mt-1 block">{status.serialSessions}</b></div><div className="rounded bg-[#0d1117] p-3 text-xs"><span className="text-gray-600">网络会话</span><b className="mt-1 block">{status.networkSessions}</b></div><div className="rounded bg-[#0d1117] p-3 text-xs"><span className="text-gray-600">构建任务</span><b className="mt-1 block">{status.buildJobs}</b></div></div>}
    </section>
    {status && <section className="rounded-xl border border-[#30363d] bg-[#161b22] p-5"><h2 className="flex items-center gap-2 font-semibold"><Server size={17} className="text-blue-400" />已启用能力</h2><div className="mt-4 flex flex-wrap gap-2">{status.capabilities.map(item => <span key={item} className="rounded border border-green-500/20 bg-green-500/5 px-2.5 py-1 text-xs text-green-300">{capabilityLabels[item] ?? item}</span>)}</div></section>}
    {state !== 'online' && <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5"><h2 className="font-semibold">安装正式发布包</h2><p className="mt-2 text-xs leading-5 text-gray-500">从 GitHub Releases 下载与你的系统匹配且带校验摘要的 EmbedKit Local Agent。安装和首次授权必须由用户确认，网页不会静默执行本机程序。</p><a href={RELEASES_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs text-white"><ExternalLink size={13} />打开发布包页面</a></div><div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5"><h2 className="font-semibold">源码启动兜底</h2><p className="mt-2 text-xs leading-5 text-gray-500">发布包尚未提供当前平台时，需要 Node.js 22；在项目的 proxy 目录执行：</p><pre className="mt-3 overflow-auto rounded bg-[#0d1117] p-3 text-xs text-gray-300">npm ci{`\n`}npm start</pre><p className="mt-2 text-[11px] text-gray-600">启动后返回此页点击“重新检测”。不要把 Agent 监听地址改为公网网卡。</p></div></section>}
    <section className="rounded-xl border border-[#30363d] bg-[#161b22] p-5"><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={17} className="text-green-400" />权限与故障边界</h2><div className="mt-3 grid gap-2 text-xs leading-5 text-gray-500 sm:grid-cols-2"><p>文件和目录只能通过系统选择器授权；选择令牌短期有效，不接受网页任意路径读取。</p><p>Agent 离线不会影响 CRC、协议解析、MAP 等纯浏览器工具，也不会导致已保存项目和测试套件丢失。</p><p>协议不兼容时应升级发布包，不建议通过关闭协议检查继续使用。</p><p className="flex gap-2"><TriangleAlert size={14} className="mt-0.5 shrink-0 text-yellow-400" />诊断文件不包含源码、固件、密钥或文件绝对路径，可用于定位版本与连接问题。</p></div></section>
  </div></div>;
}
