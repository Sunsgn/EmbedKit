import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Download, ExternalLink, RefreshCw, Server, ShieldCheck, TriangleAlert, WifiOff } from 'lucide-react';
import { AgentClientError, AGENT_PROTOCOL_VERSION, getAgentStatus, type AgentStatus } from '../services/agentClient';
import { LOCAL_PROXY_BASE } from '../services/aiService';

type AgentState = 'checking' | 'online' | 'offline' | 'incompatible' | 'error';
const RELEASES_URL = 'https://github.com/sunsgn/EmbedKit/releases/latest';
const RELEASE_DOWNLOAD_BASE = `${RELEASES_URL}/download`;
const portablePackages = [
  { id: 'windows-x64', label: 'Windows x64', file: 'embedkit-local-agent-windows-x64.zip', start: '完整解压后双击 start-agent.cmd' },
  { id: 'linux-x64', label: 'Linux x64', file: 'embedkit-local-agent-linux-x64.tar.gz', start: '解压后执行 ./start-agent.sh' },
  { id: 'macos-arm64', label: 'macOS Apple 芯片', file: 'embedkit-local-agent-macos-arm64.tar.gz', start: '解压后执行 ./start-agent.sh' },
  { id: 'macos-x64', label: 'macOS Intel', file: 'embedkit-local-agent-macos-x64.tar.gz', start: '解压后执行 ./start-agent.sh' },
] as const;

function preferredPackageId() {
  const platform = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
  if (platform.includes('win')) return 'windows-x64';
  if (platform.includes('mac')) return platform.includes('arm') ? 'macos-arm64' : 'macos-x64';
  if (platform.includes('linux')) return 'linux-x64';
  return null;
}
const publicAgentEndpoint = (() => { try { const url = new URL(LOCAL_PROXY_BASE); url.username = ''; url.password = ''; url.search = ''; url.hash = ''; return url.toString().replace(/\/$/, ''); } catch { return '本机自定义地址'; } })();
const capabilityLabels: Record<string, string> = {
  serial: '真实串口', 'tcp-client': 'TCP 客户端', 'tcp-server': 'TCP 服务端', udp: 'UDP', 'udp-server': 'UDP 服务端', websocket: 'WebSocket',
  'serial-driver-diagnostics': '串口驱动诊断', 'serial-driver-installation': '受控串口驱动安装',
  'local-picker': '系统文件/目录选择', 'file-read': '受控文件读取', 'elf-analysis': 'ELF / DWARF', 'project-build': '工程识别与可选构建',
  'software-environment': '开发软件与版本检测', 'software-installation': '受控开发软件安装',
};

function saveJson(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}

export default function LocalAgentPage() {
  const [state, setState] = useState<AgentState>('checking'), [status, setStatus] = useState<AgentStatus | null>(null), [detail, setDetail] = useState('');
  const preferredId = preferredPackageId();
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
    {state !== 'online' && <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5"><h2 className="font-semibold">下载 Local Agent 便携版</h2><p className="mt-2 text-xs leading-5 text-gray-500">发布包是免安装便携包，不是 EXE/MSI 安装器。请选择系统、下载后完整解压，再运行包内启动脚本；网页不会静默安装或执行本机程序。</p><div className="mt-4 grid gap-2">{portablePackages.map(item => <div key={item.id} className={`rounded border p-3 ${item.id === preferredId ? 'border-blue-500/40 bg-blue-500/5' : 'border-[#30363d]'}`}><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium text-gray-200">{item.label}{item.id === preferredId && <span className="ml-2 text-[10px] text-blue-400">当前系统</span>}</span><span className="flex gap-2"><a href={`${RELEASE_DOWNLOAD_BASE}/${item.file}`} className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1.5 text-[11px] text-white"><Download size={12} />下载</a><a href={`${RELEASE_DOWNLOAD_BASE}/${item.file.replace(/\.(zip|tar\.gz)$/, '.sha256')}`} className="rounded border border-[#30363d] px-2.5 py-1.5 text-[11px] text-gray-300">SHA-256</a></span></div><p className="mt-2 text-[11px] text-gray-500">{item.start}</p></div>)}</div><p className="mt-3 text-[11px] leading-5 text-yellow-500/80">若下载显示 404，表示仓库尚未创建正式 Release 或该平台构建失败。请打开发布页确认资产，不要把 Actions 临时产物当作正式包。</p><a href={RELEASES_URL} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-blue-400"><ExternalLink size={12} />查看版本、文件大小和发布说明</a></div><div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5"><h2 className="font-semibold">启动与故障恢复</h2><ol className="mt-3 list-decimal space-y-2 pl-4 text-xs leading-5 text-gray-500"><li>同时下载发布包和同名 <code>.sha256</code>，校验文件完整性。</li><li>把整个压缩包解压到普通目录；不要在 ZIP 预览窗口内直接运行，也不要只复制启动脚本。</li><li>Windows 双击 <code>start-agent.cmd</code>；macOS/Linux 执行 <code>./start-agent.sh</code>，并保持窗口运行。</li><li>若系统拦截未签名脚本，仅在核对来源和摘要后显式允许；不要关闭系统安全功能。</li><li>返回本页点击“重新检测”。仍失败时导出上方诊断文件。</li></ol><div className="mt-5 border-t border-[#30363d] pt-4"><h3 className="text-xs font-medium text-gray-300">源码启动兜底</h3><p className="mt-2 text-[11px] leading-5 text-gray-500">正式包未覆盖当前平台时，需要 Node.js 22；在项目的 proxy 目录执行：</p><pre className="mt-2 overflow-auto rounded bg-[#0d1117] p-3 text-xs text-gray-300">npm ci{`\n`}npm start</pre></div></div></section>}
    <section className="rounded-xl border border-[#30363d] bg-[#161b22] p-5"><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={17} className="text-green-400" />权限与故障边界</h2><div className="mt-3 grid gap-2 text-xs leading-5 text-gray-500 sm:grid-cols-2"><p>文件和目录只能通过系统选择器授权；选择令牌短期有效，不接受网页任意路径读取。</p><p>Agent 离线不会影响 CRC、协议解析、MAP 等纯浏览器工具，也不会导致已保存项目和测试套件丢失。</p><p>协议不兼容时应升级发布包，不建议通过关闭协议检查继续使用。</p><p className="flex gap-2"><TriangleAlert size={14} className="mt-0.5 shrink-0 text-yellow-400" />诊断文件不包含源码、固件、密钥或文件绝对路径，可用于定位版本与连接问题。</p></div></section>
  </div></div>;
}
