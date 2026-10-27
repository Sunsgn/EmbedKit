import { useEffect, useState, type ComponentType } from 'react';
import { ArrowRight, BookOpen, Boxes, BrainCircuit, Code2, Cpu, DatabaseBackup, FlaskConical, HardDrive, MonitorCog, Radio, ShieldCheck, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AgentClientError, getAgentStatus, type AgentStatus } from '../services/agentClient';
import { listEngineeringProjects } from '../services/productStorage';

interface WorkbenchAction { path: string; title: string; description: string; icon: ComponentType<{ size?: number; className?: string }>; }
interface WorkbenchGroup { title: string; description: string; color: string; icon: ComponentType<{ size?: number; className?: string }>; actions: WorkbenchAction[]; }

const primaryGroups: WorkbenchGroup[] = [
  { title: '工程与已有材料', description: '记录程序功能，识别源码结构，并分析用户主动导入的工程文件和产物。', color: 'purple', icon: HardDrive, actions: [
    { path: '/engineering', title: '工程中心', description: '管理工程说明、目录和已有材料', icon: HardDrive },
    { path: '/projects', title: '工程分析', description: '从源码证据理解陌生程序', icon: Code2 },
  ] },
  { title: '资料与学习', description: '集中查询芯片、元器件、官方文档和平台无关教程。', color: 'blue', icon: Boxes, actions: [
    { path: '/resources', title: '资料中心', description: '查询芯片、手册和官方来源', icon: Boxes },
    { path: '/learn', title: '学习中心', description: '按主题查找知识与实践路线', icon: BookOpen },
  ] },
  { title: '通信与确定性工具', description: '直接使用通信终端和固件、产物、协议及计算工具。', color: 'green', icon: Wrench, actions: [
    { path: '/communication', title: '通信调试', description: '串口、TCP、UDP 与 WebSocket', icon: Radio },
    { path: '/toolbox', title: '嵌入式工具箱', description: '按需打开独立本地工具', icon: Wrench },
  ] },
  { title: '数据与 AI 协作', description: '管理本地备份；工具结果可导出后交给用户选择的 AI。', color: 'orange', icon: DatabaseBackup, actions: [
    { path: '/data', title: '数据管理', description: '备份、迁移和恢复工作区数据', icon: DatabaseBackup },
    { path: '/ai', title: '可选本地 AI', description: '需要时连接 Ollama 或 LM Studio', icon: BrainCircuit },
  ] },
];

const secondaryActions: WorkbenchAction[] = [
  { path: '/environment', title: '开发环境', description: '需要时检测本机软件与版本', icon: MonitorCog },
  { path: '/tests', title: '集成测试', description: '需要重复执行通信步骤时使用', icon: FlaskConical },
  { path: '/agent', title: '本地助手', description: '需要串口、文件和本机工具权限时使用', icon: Radio },
];

const colorStyles: Record<string, string> = { blue: 'bg-blue-500/10 text-blue-400', green: 'bg-green-500/10 text-green-400', orange: 'bg-orange-500/10 text-orange-400', purple: 'bg-purple-500/10 text-purple-400' };

export default function DashboardPage() {
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AgentStatus | null>(null), [agentState, setAgentState] = useState<'checking' | 'online' | 'offline' | 'incompatible'>('checking'), [projectCount, setProjectCount] = useState(0);
  useEffect(() => { let stopped = false; void Promise.all([getAgentStatus().then(status => ({ status, state: 'online' as const })).catch(reason => ({ status: null, state: reason instanceof AgentClientError && reason.kind === 'incompatible' ? 'incompatible' as const : 'offline' as const })), listEngineeringProjects().catch(() => [])]).then(([agentResult, projects]) => { if (stopped) return; setAgent(agentResult.status); setAgentState(agentResult.state); setProjectCount(projects.length); }); return () => { stopped = true; }; }, []);
  return <div className="h-full overflow-y-auto p-5 scrollbar-thin lg:p-8"><div className="mx-auto max-w-7xl">
    <header className="dashboard-hero mb-7 overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-[#161b22] to-purple-500/10 p-6 lg:p-8"><div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
      <div className="max-w-3xl"><div className="mb-3 flex items-center gap-2 text-xs font-medium text-blue-400"><Cpu size={15} /> LOCAL EMBEDDED WORKBENCH</div><h1 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">工程、资料、通信和常用工具<br className="hidden sm:block" />集中在一个本地入口</h1><p className="mt-4 text-sm leading-7 text-gray-400">EmbedKit 不接管 IDE 的编译与烧录；它负责整理工程和开发资料，并提供可独立使用、结果可带走的本地分析与确定性工具。</p></div>
      <div className="grid min-w-72 gap-2 text-xs"><div className="flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-purple-300"><HardDrive size={14} />{projectCount} 个本地工程档案</div><div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${agentState === 'online' ? 'border-green-500/20 bg-green-500/5 text-green-300' : 'border-yellow-500/20 bg-yellow-500/5 text-yellow-300'}`}><Radio size={14} />Local Agent：{agentState === 'online' && agent ? `v${agent.version} · ${agent.capabilities.length} 项本机能力` : agentState === 'incompatible' ? '协议不兼容，请更新本地助手' : agentState === 'checking' ? '检测中' : '未连接（浏览器工具仍可使用）'}</div><div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-blue-300"><ShieldCheck size={14} />源码、固件和日志默认留在本机</div></div>
    </div></header>
    <section className="mb-7"><div className="mb-4"><h2 className="text-lg font-semibold text-white">日常工作入口</h2><p className="mt-1 text-xs text-gray-500">选择当前任务，不要求先创建项目，也不要求连接 AI 或本地助手</p></div><div className="grid gap-4 lg:grid-cols-2">{primaryGroups.map(({ title, description, color, icon: Icon, actions }) => <article key={title} className="rounded-xl border border-[#30363d] bg-[#161b22] p-5"><div className="flex items-start gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colorStyles[color]}`}><Icon size={20} /></span><div><h3 className="text-sm font-semibold text-gray-100">{title}</h3><p className="mt-1 text-xs leading-5 text-gray-500">{description}</p></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{actions.map(({ path, title: actionTitle, description: actionDescription, icon: ActionIcon }) => <button key={path} onClick={() => navigate(path)} className="group flex items-center gap-3 rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-left hover:border-[#484f58]"><ActionIcon size={15} className="shrink-0 text-gray-500 group-hover:text-blue-400" /><span className="min-w-0 flex-1"><b className="block text-xs text-gray-300">{actionTitle}</b><small className="mt-0.5 block text-[10px] text-gray-600">{actionDescription}</small></span><ArrowRight size={13} className="text-gray-700 group-hover:text-gray-400" /></button>)}</div></article>)}</div></section>
    <section className="mb-5"><div className="mb-3"><h2 className="text-sm font-semibold text-gray-300">按需使用的扩展能力</h2><p className="mt-1 text-[11px] text-gray-600">这些模块继续保留，但不是使用其他工具的前置条件</p></div><div className="grid gap-3 md:grid-cols-3">{secondaryActions.map(({ path, title, description, icon: Icon }) => <button key={path} onClick={() => navigate(path)} className="flex items-center gap-3 rounded-xl border border-[#30363d] bg-[#161b22] p-4 text-left hover:border-blue-500/30"><Icon size={17} className="text-blue-400" /><span><b className="block text-xs text-gray-300">{title}</b><small className="mt-1 block text-[10px] text-gray-600">{description}</small></span></button>)}</div></section>
    <section className="rounded-xl border border-dashed border-[#30363d] p-4 text-xs leading-6 text-gray-500"><ShieldCheck size={15} className="mr-2 inline text-green-400" />AI 是可选消费者，不是平台依赖。各工具负责本地解析、严格校验和导出结果；用户可以把导出内容交给任意 AI、同事或现有开发流程。</section>
  </div></div>;
}
