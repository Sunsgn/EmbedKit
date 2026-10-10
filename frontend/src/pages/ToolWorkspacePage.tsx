import { Suspense } from 'react';
import { ArrowLeft, Wrench } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import ToolErrorBoundary from '../features/toolbox/ToolErrorBoundary';
import { findTool } from '../tools/registry';

export default function ToolWorkspacePage() {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const tool = findTool(toolId);
  const back = () => navigate('/toolbox');

  if (!tool) return <div className="h-full overflow-y-auto p-5 lg:p-8"><div className="mx-auto max-w-4xl rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6"><h1 className="text-lg font-semibold text-yellow-300">未找到这个工具</h1><p className="mt-2 text-sm text-gray-500">工具可能已经更名，或者当前地址不完整。</p><button onClick={back} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">返回工具箱</button></div></div>;

  const ToolComponent = tool.component;
  const Icon = tool.icon;
  return <div className="h-full overflow-y-auto p-5 scrollbar-thin lg:p-8"><div className="mx-auto max-w-5xl"><button onClick={back} className="mb-4 flex items-center gap-2 text-xs text-gray-500 hover:text-white"><ArrowLeft size={14} />返回工具箱</button><section className="rounded-xl border border-[#30363d] bg-[#161b22] p-5"><header className="mb-5 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400"><Icon size={19} /></span><div><div className="flex items-center gap-2"><h1 className="text-base font-semibold text-white">{tool.title}</h1>{!tool.requiresAgent && <span className="rounded bg-green-500/10 px-2 py-0.5 text-[9px] text-green-400">浏览器直接使用</span>}</div><p className="mt-1 text-xs text-gray-500">{tool.detail}</p></div></header><ToolErrorBoundary onBack={back}><Suspense fallback={<div className="flex min-h-48 items-center justify-center text-xs text-gray-500"><Wrench size={14} className="mr-2 animate-pulse" />正在加载工具…</div>}><ToolComponent /></Suspense></ToolErrorBoundary></section></div></div>;
}
