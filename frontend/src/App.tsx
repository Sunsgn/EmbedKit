import { useState } from 'react';
import { Route, BrowserRouter as Router, Routes, useNavigate, useLocation } from 'react-router-dom';
import {
  Code2,
  Cpu,
  BookOpen,
  Terminal,
  Download,
  Users,
  Puzzle,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
import EditorPage from './pages/EditorPage';
import ChipLibPage from './pages/ChipLibPage';
import TutorialPage from './pages/TutorialPage';
import SerialPage from './pages/SerialPage';

const navItems = [
  { icon: Code2, label: '代码编辑器', path: '/editor' },
  { icon: Cpu, label: '芯片库', path: '/chips' },
  { icon: BookOpen, label: '教程', path: '/tutorials' },
  { icon: Terminal, label: '串口调试', path: '/serial' },
  { icon: Sparkles, label: 'AI 助手', path: '/ai' },
  { icon: Users, label: '协作', path: '/collab' },
  { icon: Puzzle, label: '插件', path: '/plugins' },
  { icon: Download, label: '桌面版', path: '/download' },
];

function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (v: boolean) => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#161b22] border-r border-[#30363d]
          transform transition-transform duration-200 flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Cpu size={18} />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              EmbedKit
            </h1>
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map(({ icon: Icon, label, path }) => {
            const isActive = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => {
                  navigate(path);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                  ${isActive
                    ? 'bg-blue-500/10 text-blue-400 font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-[#1c2128]'
                  }`}
              >
                <Icon size={18} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#30363d]">
          <div className="text-xs text-gray-500 text-center">
            EmbedKit v0.1.0
          </div>
        </div>
      </aside>
    </>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <Router>
      <div className="flex h-screen bg-[#0d1117]">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="h-12 bg-[#161b22] border-b border-[#30363d] flex items-center px-4 lg:hidden">
            <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white">
              <Menu size={20} />
            </button>
          </header>

          <div className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<EditorPage />} />
              <Route path="/editor" element={<EditorPage />} />
              <Route path="/chips" element={<ChipLibPage />} />
              <Route path="/tutorials" element={<TutorialPage />} />
              <Route path="/serial" element={<SerialPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;
