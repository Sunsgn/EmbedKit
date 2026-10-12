import { lazy, Suspense, useState, type ComponentType } from 'react';
import { HashRouter as Router, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Boxes, BrainCircuit, Code2, Cpu, DatabaseBackup, FlaskConical, Gauge, HardDrive, Menu, Radio, Wrench, X } from 'lucide-react';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const DeviceProjectsPage = lazy(() => import('./pages/DeviceProjectsPage'));
const EditorPage = lazy(() => import('./pages/EditorPage'));
const CommunicationPage = lazy(() => import('./pages/CommunicationPage'));
const TestAutomationPage = lazy(() => import('./pages/TestAutomationPage'));
const ToolboxPage = lazy(() => import('./pages/ToolboxPage'));
const ToolWorkspacePage = lazy(() => import('./pages/ToolWorkspacePage'));
const ChipLibPage = lazy(() => import('./pages/ChipLibPage'));
const TutorialPage = lazy(() => import('./pages/TutorialPage'));
const AiPage = lazy(() => import('./pages/AiPage'));
const DataManagementPage = lazy(() => import('./pages/DataManagementPage'));

interface NavItem {
  icon: ComponentType<{ size?: number }>;
  label: string;
  path: string;
  aliases?: string[];
}

const navSections: Array<{ title: string; items: NavItem[] }> = [
  {
    title: '开发工作区',
    items: [
      { icon: Gauge, label: '工作台', path: '/' },
      { icon: HardDrive, label: '设备项目', path: '/devices' },
      { icon: Code2, label: '工程分析', path: '/projects', aliases: ['/editor'] },
      { icon: Radio, label: '通信调试', path: '/communication', aliases: ['/serial'] },
      { icon: FlaskConical, label: '集成测试', path: '/tests' },
      { icon: Wrench, label: '嵌入式工具箱', path: '/toolbox' },
      { icon: BrainCircuit, label: 'AI 助手', path: '/ai' },
    ],
  },
  {
    title: '知识中心',
    items: [
      { icon: Boxes, label: '资料中心', path: '/resources', aliases: ['/components', '/chips'] },
      { icon: BookOpen, label: '学习中心', path: '/learn', aliases: ['/tutorials'] },
    ],
  },
  {
    title: '系统',
    items: [
      { icon: DatabaseBackup, label: '数据管理', path: '/data' },
    ],
  },
];

function LoadingPage() {
  return <div className="flex h-full items-center justify-center text-sm text-gray-500"><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />正在加载工作区…</div>;
}

function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (value: boolean) => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  return <>
    {isOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setIsOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#30363d]/80 bg-[#141920]/95 shadow-2xl shadow-black/30 backdrop-blur transition-transform duration-200 lg:static ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <div className="flex items-center justify-between border-b border-[#30363d]/80 px-4 py-[18px]">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-left">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-950/50"><Cpu size={19} /></span>
          <span><b className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-lg text-transparent">EmbedKit</b><small className="block text-[10px] text-gray-600">嵌入式开发工作台</small></span>
        </button>
        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white lg:hidden" aria-label="关闭菜单"><X size={20} /></button>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto p-3 scrollbar-thin">
        {navSections.map((section) => <section key={section.title}>
          <h2 className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-600">{section.title}</h2>
          <div className="space-y-1">{section.items.map(({ icon: Icon, label, path, aliases = [] }) => {
            const active = location.pathname === path || aliases.includes(location.pathname) || (path !== '/' && location.pathname.startsWith(`${path}/`));
            return <button key={path} onClick={() => { navigate(path); setIsOpen(false); }} className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm transition-all ${active ? 'bg-gradient-to-r from-blue-500/15 to-purple-500/[0.06] font-medium text-blue-300 shadow-sm shadow-black/10' : 'text-gray-400 hover:bg-[#1c2128] hover:text-white'}`}>{active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-blue-400" />}<span className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${active ? 'bg-blue-500/15 text-blue-400' : 'bg-transparent group-hover:bg-white/[0.04]'}`}><Icon size={16} /></span>{label}</button>;
          })}</div>
        </section>)}
      </nav>
      <div className="border-t border-[#30363d]/80 p-4"><div className="flex items-center justify-between rounded-lg border border-[#30363d]/70 bg-[#0d1117]/60 px-3 py-2"><span><b className="block text-[11px] font-medium text-gray-400">EmbedKit v0.2.0</b><small className="text-[9px] text-gray-600">本地优先 · 数据可控</small></span><i className="h-2 w-2 rounded-full bg-green-400 shadow-sm shadow-green-400" title="本地工作台可用" /></div></div>
    </aside>
  </>;
}

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return <div className="flex h-screen bg-[#0d1117]">
    <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_80%_-20%,rgba(59,130,246,0.08),transparent_36%),#0d1117]">
      <header className="flex h-13 shrink-0 items-center border-b border-[#30363d]/80 bg-[#161b22]/95 px-4 shadow-sm shadow-black/20 backdrop-blur lg:hidden"><button onClick={() => setSidebarOpen(true)} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="打开菜单"><Menu size={20} /></button><span className="ml-3 text-sm font-semibold">EmbedKit</span><span className="ml-2 rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] text-blue-400">WORKBENCH</span></header>
      <div className="min-h-0 flex-1 overflow-hidden"><Suspense fallback={<LoadingPage />}><Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/devices" element={<DeviceProjectsPage />} />
        <Route path="/projects" element={<EditorPage />} />
        <Route path="/editor" element={<Navigate to="/projects" replace />} />
        <Route path="/communication" element={<CommunicationPage />} />
        <Route path="/tests" element={<TestAutomationPage />} />
        <Route path="/serial" element={<Navigate to="/communication" replace />} />
        <Route path="/toolbox" element={<ToolboxPage />} />
        <Route path="/toolbox/:toolId" element={<ToolWorkspacePage />} />
        <Route path="/resources" element={<ChipLibPage />} />
        <Route path="/components" element={<Navigate to="/resources" replace />} />
        <Route path="/chips" element={<Navigate to="/resources" replace />} />
        <Route path="/learn" element={<TutorialPage />} />
        <Route path="/tutorials" element={<Navigate to="/learn" replace />} />
        <Route path="/ai" element={<AiPage />} />
        <Route path="/data" element={<DataManagementPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></Suspense></div>
    </main>
  </div>;
}

export default function App() {
  return <Router><AppShell /></Router>;
}
