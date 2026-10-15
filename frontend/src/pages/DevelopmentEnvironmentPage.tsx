import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, FolderDown, MonitorCog, RefreshCw, Square, TriangleAlert, WifiOff, XCircle } from 'lucide-react';
import { AgentClientError, getAgentStatus, hasAgentCapability } from '../services/agentClient';
import { cancelSoftwareInstallJob, createSoftwareInstallJob, getSoftwareInstallJob, listSoftwareInstallManifests, resolveEnvironmentRequirements, scanDevelopmentSoftware } from '../services/developmentEnvironment';
import { revokeLocalPath, selectLocalDirectory, type LocalPathSelection } from '../services/localFiles';
import { listEngineeringProjects } from '../services/productStorage';
import type { EngineeringProject } from '../types/product';
import type { SoftwareEnvironmentScan, SoftwareInstallJob, SoftwareInstallManifest } from '../types/developmentEnvironment';

const statusStyle = {
  satisfied: { icon: CheckCircle2, label: '满足', className: 'text-green-400' }, missing: { icon: XCircle, label: '缺失', className: 'text-red-400' },
  incompatible: { icon: TriangleAlert, label: '版本不兼容', className: 'text-yellow-400' }, 'unknown-version': { icon: TriangleAlert, label: '版本待确认', className: 'text-yellow-400' },
} as const;
interface PendingInstall { manifest: SoftwareInstallManifest; selection: LocalPathSelection }

export default function DevelopmentEnvironmentPage() {
  const [projects, setProjects] = useState<EngineeringProject[]>([]), [projectId, setProjectId] = useState(''), [scan, setScan] = useState<SoftwareEnvironmentScan | null>(null), [manifests, setManifests] = useState<SoftwareInstallManifest[]>([]), [installationSupported, setInstallationSupported] = useState(false), [state, setState] = useState<'loading' | 'ready' | 'offline' | 'incompatible' | 'error'>('loading'), [message, setMessage] = useState('');
  const [pending, setPending] = useState<PendingInstall | null>(null), [acceptedLicense, setAcceptedLicense] = useState(false), [installJob, setInstallJob] = useState<SoftwareInstallJob | null>(null), [installMessage, setInstallMessage] = useState('');
  const project = projects.find(item => item.id === projectId) ?? projects[0] ?? null;
  const refresh = useCallback(async () => {
    setState('loading'); setMessage('');
    try {
      const status = await getAgentStatus();
      if (!hasAgentCapability(status, 'software-environment')) { setState('incompatible'); setMessage('当前 Local Agent 不支持软件环境检测，请更新本地助手。'); return; }
      const canInstall = hasAgentCapability(status, 'software-installation'); setInstallationSupported(canInstall);
      const [nextScan, nextManifests] = await Promise.all([scanDevelopmentSoftware(), canInstall ? listSoftwareInstallManifests() : Promise.resolve([])]);
      setScan(nextScan); setManifests(nextManifests); setState('ready');
    } catch (reason) {
      setState(reason instanceof AgentClientError && (reason.kind === 'offline' || reason.kind === 'timeout') ? 'offline' : reason instanceof AgentClientError && reason.kind === 'incompatible' ? 'incompatible' : 'error');
      setMessage(reason instanceof Error ? reason.message : String(reason));
    }
  }, []);
  useEffect(() => { void listEngineeringProjects().then(items => { setProjects(items); setProjectId(items[0]?.id ?? ''); }).catch(reason => setMessage(reason instanceof Error ? reason.message : String(reason))); const timer = window.setTimeout(() => void refresh(), 0); return () => clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    if (!installJob || installJob.state !== 'running') return;
    let active = true; const timer = window.setTimeout(async () => {
      try { const next = await getSoftwareInstallJob(installJob.id); if (!active) return; setInstallJob(next); if (next.state === 'passed') { setInstallMessage(`安装完成：${next.installPath ?? next.name}`); await refresh(); } else if (next.state === 'failed') setInstallMessage(`安装失败：${next.error || '请查看任务事件'}`); else if (next.state === 'cancelled') setInstallMessage('安装已取消，本任务新建目录已清理。'); }
      catch (reason) { if (active) { setInstallMessage(reason instanceof Error ? `${reason.message}；将继续查询任务状态。` : `${String(reason)}；将继续查询任务状态。`); setInstallJob(current => current?.id === installJob.id ? { ...current } : current); } }
    }, 500);
    return () => { active = false; window.clearTimeout(timer); };
  }, [installJob, refresh]);
  const resolutions = useMemo(() => resolveEnvironmentRequirements(project?.environmentRequirements ?? [], scan?.installations ?? []), [project, scan]);
  const blocking = resolutions.filter(item => item.blocking).length;
  const chooseInstallDirectory = async (manifest: SoftwareInstallManifest) => {
    setInstallMessage('');
    try { const selection = await selectLocalDirectory(); if (selection.cancelled || !selection.selectionId || !selection.path) { setInstallMessage('未选择安装目录，未进行任何更改。'); return; } setPending({ manifest, selection }); setAcceptedLicense(false); }
    catch (reason) { setInstallMessage(reason instanceof Error ? reason.message : String(reason)); }
  };
  const dismissPending = async () => { const id = pending?.selection.selectionId; setPending(null); if (id) await revokeLocalPath(id).catch(() => undefined); };
  const confirmInstall = async () => {
    if (!pending?.selection.selectionId) return;
    try { setInstallMessage('正在创建受控安装任务…'); const next = await createSoftwareInstallJob(pending.manifest.id, pending.selection.selectionId, acceptedLicense); setInstallJob(next); setInstallMessage('正在下载并校验官方软件包。'); await revokeLocalPath(pending.selection.selectionId).catch(() => undefined); setPending(null); }
    catch (reason) { setInstallMessage(reason instanceof Error ? reason.message : String(reason)); }
  };
  const cancelInstall = async () => { if (!installJob || installJob.state !== 'running') return; try { setInstallJob(await cancelSoftwareInstallJob(installJob.id)); setInstallMessage('正在取消安装并清理本次新建目录…'); } catch (reason) { setInstallMessage(reason instanceof Error ? reason.message : String(reason)); } };

  return <div className="h-full overflow-y-auto p-5 scrollbar-thin lg:p-8"><div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-medium text-blue-400">DEVELOPMENT ENVIRONMENT</p><h1 className="mt-1 text-2xl font-bold">开发环境</h1><p className="mt-2 text-sm text-gray-500">检测本机实际工具版本，与工程需求匹配，并按固定官方清单安装可安全验证的便携工具。</p></div><button onClick={() => void refresh()} disabled={state === 'loading'} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs text-white disabled:opacity-50"><RefreshCw size={13} className={state === 'loading' ? 'animate-spin' : ''} />重新检测</button></header>
    {state !== 'ready' && <section className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5"><div className="flex gap-3"><WifiOff className="shrink-0 text-yellow-400" /><div><b className="text-sm">{state === 'loading' ? '正在检测本机环境…' : state === 'incompatible' ? '本地助手版本不兼容' : state === 'offline' ? '本地助手未连接' : '环境检测失败'}</b>{message && <p className="mt-1 text-xs text-gray-500">{message}</p>}<p className="mt-1 text-xs text-gray-600">工程档案、资料、教程和纯浏览器工具仍可使用。</p></div></div></section>}
    <section className="rounded-xl border border-[#30363d] bg-[#161b22] p-5"><div className="flex flex-wrap items-center gap-3"><MonitorCog size={18} className="text-blue-400" /><div className="min-w-0 flex-1"><h2 className="font-semibold">工程需求诊断</h2><p className="text-[11px] text-gray-600">安装只接受 Agent 内置的固定版本、官方 HTTPS 来源、大小与 SHA-256；网页不能传入下载地址或命令。</p></div>{projects.length > 0 && <select value={project?.id ?? ''} onChange={event => setProjectId(event.target.value)} className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs">{projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}</div>
      {!project ? <div className="mt-4 rounded border border-dashed border-[#30363d] py-8 text-center text-xs text-gray-600">尚无工程档案。仍可在下方查看本机已检测软件。</div> : (project.environmentRequirements ?? []).length === 0 ? <div className="mt-4 rounded border border-dashed border-[#30363d] py-8 text-center text-xs text-gray-600">当前工程尚未记录环境需求，请在“工程中心”添加稳定能力 ID 和版本范围。</div> : <div className="mt-4 space-y-2">{resolutions.map(result => { const meta = statusStyle[result.status], Icon = meta.icon, manifest = manifests.find(item => item.capabilityId === result.requirement.capabilityId); return <article key={result.requirement.id} className="grid gap-2 rounded-lg border border-[#30363d] bg-[#0d1117] p-3 md:grid-cols-[1fr_160px_130px_2fr_auto]"><div><b className="text-xs">{result.requirement.displayName}</b><p className="text-[10px] text-gray-600">{result.requirement.capabilityId}</p></div><span className="text-xs text-gray-400">要求 {result.requirement.versionRange || '任意版本'}</span><span className={`flex items-center gap-1 text-xs ${meta.className}`}><Icon size={13} />{meta.label}</span><p className="text-xs text-gray-500">{result.reason}</p>{result.status !== 'satisfied' && manifest && <button onClick={() => void chooseInstallDirectory(manifest)} disabled={Boolean(installJob?.state === 'running' || pending)} className="rounded border border-blue-500/30 px-2 py-1 text-[11px] text-blue-300 disabled:opacity-40"><FolderDown size={12} className="mr-1 inline" />选择目录并安装</button>}</article>; })}<p className={`text-xs ${blocking ? 'text-yellow-400' : 'text-green-400'}`}>{blocking ? `${blocking} 项必需环境尚未满足` : '所有可核验的必需环境均已满足'}</p></div>}
      {state === 'ready' && !installationSupported && <p className="mt-3 text-xs text-yellow-400">当前 Agent 可检测环境，但不支持受控安装；请更新 Agent，或自行从厂商官方页面安装。</p>}
    </section>
    {pending && <section aria-label="安装确认" className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5"><h2 className="font-semibold">确认安装 {pending.manifest.name} {pending.manifest.version}</h2><div className="mt-3 grid gap-2 text-xs text-gray-400 md:grid-cols-2"><p>安装根目录：<span className="break-all text-gray-200">{pending.selection.path}</span></p><p>软件包：{(pending.manifest.byteLength / 1024).toFixed(1)} KiB · {pending.manifest.archive}</p><p>许可证：{pending.manifest.license}</p><p>清单验证日期：{pending.manifest.verifiedAt}</p></div><a href={pending.manifest.officialPage} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-blue-300">查看官方发布页<ExternalLink size={12} /></a>{pending.manifest.requiresLicenseAcceptance && <label className="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={acceptedLicense} onChange={event => setAcceptedLicense(event.target.checked)} />我已阅读并接受许可证</label>}<p className="mt-3 text-[11px] text-gray-500">仅在所选目录内创建版本化子目录；校验、解压或版本验证失败时清理本任务新建目录，不修改系统 PATH。</p><div className="mt-4 flex gap-2"><button onClick={() => void confirmInstall()} disabled={pending.manifest.requiresLicenseAcceptance && !acceptedLicense} className="rounded bg-blue-600 px-3 py-2 text-xs text-white disabled:opacity-40">确认下载并安装</button><button onClick={() => void dismissPending()} className="rounded border border-[#30363d] px-3 py-2 text-xs">取消</button></div></section>}
    {(installJob || installMessage) && <section aria-label="安装状态" className="rounded-xl border border-[#30363d] bg-[#161b22] p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">安装任务{installJob ? ` · ${installJob.name} ${installJob.version}` : ''}</h2><p className="mt-1 text-xs text-gray-500">{installMessage || installJob?.state}</p></div>{installJob?.state === 'running' && <button onClick={() => void cancelInstall()} className="flex items-center gap-1 rounded border border-red-500/30 px-3 py-2 text-xs text-red-300"><Square size={11} />取消任务</button>}</div>{installJob && <><div className="mt-3 h-2 overflow-hidden rounded bg-[#0d1117]"><div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, installJob.progress))}%` }} /></div><p className="mt-2 text-xs">状态：{installJob.state} · {installJob.progress}%</p><div className="mt-3 max-h-32 space-y-1 overflow-y-auto">{installJob.events.map((event, index) => <p key={`${event.time}-${index}`} className={`text-[11px] ${event.level === 'error' ? 'text-red-300' : 'text-gray-500'}`}>{event.message}</p>)}</div></>}</section>}
    <section className="rounded-xl border border-[#30363d] bg-[#161b22] p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold">本机已检测软件</h2><p className="mt-1 text-[11px] text-gray-600">仅显示通过无 Shell 版本命令实际验证的软件；受控安装不会自动修改系统 PATH。</p></div>{scan && <span className="text-[10px] text-gray-600">{scan.platform} / {scan.architecture}</span>}</div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">{scan?.installations.map(item => <article key={item.id} className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3"><div className="flex items-center justify-between gap-2"><b className="text-xs">{item.name}</b><span className="rounded bg-green-500/10 px-2 py-0.5 text-[10px] text-green-300">{item.version || '版本未知'}</span></div><p className="mt-2 break-all text-[10px] text-gray-600">{item.capabilityId} · {item.executable}</p><p className="mt-1 truncate text-[10px] text-gray-700" title={item.rawVersion}>{item.rawVersion}</p></article>)}{state === 'ready' && !scan?.installations.length && <div className="text-xs text-gray-600">未检测到已注册软件。</div>}</div>
    </section>
  </div></div>;
}
