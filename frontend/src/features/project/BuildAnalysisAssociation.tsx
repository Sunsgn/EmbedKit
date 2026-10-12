import { Download } from 'lucide-react';
import { createBuildAnalysisReport, listBuildAnalysisRecords, type BuildAnalysisContext } from '../../services/buildAnalysisRecords';

export default function BuildAnalysisAssociation({ context, revision = 0 }: { context: BuildAnalysisContext | null; revision?: number }) {
  if (!context) return null; const records = listBuildAnalysisRecords(context.buildId), current = records.find(item => item.artifactIndex === context.artifactIndex);
  const download = () => { const content = JSON.stringify(createBuildAnalysisReport(context.buildId), null, 2), link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' })); link.download = `embedkit-analysis-${context.buildId}.json`; link.click(); URL.revokeObjectURL(link.href); };
  return <div data-revision={revision} className="mb-3 flex flex-wrap items-center gap-2 rounded border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-[11px] text-cyan-200"><span>已关联构建 · {records.length} 项结果</span><span className={current?.status === 'failed' ? 'text-red-300' : current?.status === 'passed' ? 'text-green-300' : 'text-gray-500'}>{current ? (current.status === 'passed' ? '当前产物已记录' : '当前产物分析失败') : '当前产物待记录'}</span><button onClick={download} disabled={!records.length} className="ml-auto inline-flex items-center gap-1 rounded border border-cyan-500/30 px-2 py-1 disabled:opacity-40"><Download size={11} />导出组合报告</button></div>;
}
