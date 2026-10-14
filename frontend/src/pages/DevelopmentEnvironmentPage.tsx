import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, MonitorCog, RefreshCw, TriangleAlert, WifiOff, XCircle } from 'lucide-react';
import { AgentClientError, getAgentStatus, hasAgentCapability } from '../services/agentClient';
import { resolveEnvironmentRequirements, scanDevelopmentSoftware } from '../services/developmentEnvironment';
import { listDeviceProjects } from '../services/productStorage';
import type { DeviceProject } from '../types/product';
import type { SoftwareEnvironmentScan } from '../types/developmentEnvironment';

const statusStyle = {
  satisfied: { icon: CheckCircle2, label: '满足', className: 'text-green-400' },
  missing: { icon: XCircle, label: '缺失', className: 'text-red-400' },
  incompatible: { icon: TriangleAlert, label: '版本不兼容', className: 'text-yellow-400' },
  'unknown-version': { icon: TriangleAlert, label: '版本待确认', className: 'text-yellow-400' },
} as const;

export default function DevelopmentEnvironmentPage() {
  const [projects, setProjects] = useState<DeviceProject[]>([]), [projectId, setProjectId] = useState(''), [scan, setScan] = useState<SoftwareEnvironmentScan | null>(null), [state, setState] = useState<'loading' | 'ready' | 'offline' | 'incompatible' | 'error'>('loading'), [message, setMessage] = useState('');
  const project = projects.find(item => item.id === projectId) ?? projects[0] ?? null;
  const refresh = useCallback(async () => {
    setState('loading'); setMessage('');
    try {
      const status = await getAgentStatus();
      if (!hasAgentCapability(status, 'software-environment')) { setState('incompatible'); setMessage('当前 Local Agent 不支持软件环境检测，请更新本地助手。'); return; }
      setScan(await scanDevelopmentSoftware()); setState('ready');
    } catch (reason) {
      setState(reason instanceof AgentClientError && (reason.kind === 'offline' || reason.kind === 'timeout') ? 'offline' : reason instanceof AgentClientError && reason.kind === 'incompatible' ? 'incompatible' : 'error');
      setMessage(reason instanceof Error ? reason.message : String(reason));
    }
  }, []);
  useEffect(() => { void listDeviceProjects().then(items => { setProjects(items); setProjectId(items[0]?.id ?? ''); }).catch(reason => setMessage(reason instanceof Error ? reason.message : String(reason))); const timer = window.setTimeout(() => void refresh(), 0); return () => clearTimeout(timer); }, [refresh]);
  const resolutions = useMemo(() => resolveEnvironmentRequirements(project?.environmentRequirements ?? [], scan?.installations ?? []), [project, scan]);
  const blocking = resolutions.filter(item => item.blocking).length;

  return <div className="h-full overflow-y-auto p-5 scrollbar-thin lg:p-8"><div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-medium text-blue-400">DEVELOPMENT ENVIRONMENT</p><h1 className="mt-1 text-2xl font-bold">开发环境</h1><p className="mt-2 text-sm text-gray-500">检测本机实际工具版本，并与工程记录的 IDE、编译器、SDK 和调试能力要求进行匹配。</p></div><button onClick={() => void refresh()} disabled={state === 'loading'} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs text-white disabled:opacity-50"><RefreshCw size={13} className={state === 'loading' ? 'animate-spin' : ''} />重新检测</button></header>
    {state !== 'ready' && <section className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5"><div className="flex gap-3"><WifiOff className="shrink-0 text-yellow-400" /><div><b className="text-sm">{state === 'loading' ? '正在检测本机环境…' : state === 'incompatible' ? '本地助手版本不兼容' : state === 'offline' ? '本地助手未连接' : '环境检测失败'}</b>{message && <p className="mt-1 text-xs text-gray-500">{message}</p>}<p className="mt-1 text-xs text-gray-600">工程档案、资料、教程和纯浏览器工具仍可使用。</p></div></div></section>}
    <section className="rounded-xl border border-[#30363d] bg-[#161b22] p-5"><div className="flex flex-wrap items-center gap-3"><MonitorCog size={18} className="text-blue-400" /><div className="min-w-0 flex-1"><h2 className="font-semibold">工程需求诊断</h2><p className="text-[11px] text-gray-600">缺失项安装必须使用经过校验的正式安装清单；当前增量只进行真实检测，不会静默安装软件。</p></div>{projects.length > 0 && <select value={project?.id ?? ''} onChange={event => setProjectId(event.target.value)} className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs">{projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}</div>
      {!project ? <div className="mt-4 rounded border border-dashed border-[#30363d] py-8 text-center text-xs text-gray-600">尚无工程档案。仍可在下方查看本机已检测软件。</div> : (project.environmentRequirements ?? []).length === 0 ? <div className="mt-4 rounded border border-dashed border-[#30363d] py-8 text-center text-xs text-gray-600">当前工程尚未记录环境需求，请在“工程中心”添加稳定能力 ID 和版本范围。</div> : <div className="mt-4 space-y-2">{resolutions.map(result => { const meta = statusStyle[result.status], Icon = meta.icon; return <article key={result.requirement.id} className="grid gap-2 rounded-lg border border-[#30363d] bg-[#0d1117] p-3 md:grid-cols-[1fr_180px_150px_2fr]"><div><b className="text-xs">{result.requirement.displayName}</b><p className="text-[10px] text-gray-600">{result.requirement.capabilityId}</p></div><span className="text-xs text-gray-400">要求 {result.requirement.versionRange || '任意版本'}</span><span className={`flex items-center gap-1 text-xs ${meta.className}`}><Icon size={13} />{meta.label}</span><p className="text-xs text-gray-500">{result.reason}</p></article>; })}<p className={`text-xs ${blocking ? 'text-yellow-400' : 'text-green-400'}`}>{blocking ? `${blocking} 项必需环境尚未满足` : '所有可核验的必需环境均已满足'}</p></div>}
    </section>
    <section className="rounded-xl border border-[#30363d] bg-[#161b22] p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold">本机已检测软件</h2><p className="mt-1 text-[11px] text-gray-600">仅显示通过无 Shell 版本命令实际验证的软件；未知安装路径可在后续通过系统选择器手工绑定。</p></div>{scan && <span className="text-[10px] text-gray-600">{scan.platform} / {scan.architecture}</span>}</div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">{scan?.installations.map(item => <article key={item.id} className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3"><div className="flex items-center justify-between gap-2"><b className="text-xs">{item.name}</b><span className="rounded bg-green-500/10 px-2 py-0.5 text-[10px] text-green-300">{item.version || '版本未知'}</span></div><p className="mt-2 break-all text-[10px] text-gray-600">{item.capabilityId} · {item.executable}</p><p className="mt-1 truncate text-[10px] text-gray-700" title={item.rawVersion}>{item.rawVersion}</p></article>)}{state === 'ready' && !scan?.installations.length && <div className="text-xs text-gray-600">未检测到已注册软件。</div>}</div>
    </section>
  </div></div>;
}
