import { Calculator, ChevronRight, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toolRegistry } from '../tools/registry';

export default function ToolboxPage() {
  const navigate = useNavigate();
  return <div className="h-full overflow-y-auto p-5 scrollbar-thin lg:p-8"><div className="mx-auto max-w-7xl"><header className="mb-6"><div className="mb-2 flex items-center gap-2 text-xs text-orange-400"><Wrench size={15} /> EMBEDDED UTILITIES</div><h1 className="text-2xl font-bold">嵌入式工具箱</h1><p className="mt-2 text-sm text-gray-500">选择工具后进入独立工作区；所有计算均在本地完成，不上传输入内容。</p></header>
    <nav aria-label="嵌入式工具目录" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{toolRegistry.map(({ id, title, description, icon: Icon, requiresAgent }) => <button key={id} type="button" onClick={() => navigate(`/toolbox/${id}`)} className="group flex items-center gap-3 rounded-xl border border-[#30363d] bg-[#161b22] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#484f58]"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0d1117] text-gray-500 group-hover:text-blue-400"><Icon size={18} /></span><span className="min-w-0 flex-1"><b className="block text-sm text-gray-200">{title}</b><small className="mt-1 block text-[11px] text-gray-600">{description}</small><span className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[9px] ${requiresAgent ? 'bg-yellow-500/10 text-yellow-400' : 'bg-green-500/10 text-green-400'}`}>{requiresAgent ? '需要本地助手' : '浏览器直接使用'}</span></span><ChevronRight size={14} className="text-gray-700 group-hover:text-gray-400" /></button>)}</nav>
    <div className="mt-5 rounded-xl border border-dashed border-[#30363d] p-4 text-center text-xs text-gray-600"><Calculator size={15} className="mr-2 inline" />{toolRegistry.length} 个工具均可离线独立使用；文件只在浏览器本地读取，不上传。</div>
  </div></div>;
}
