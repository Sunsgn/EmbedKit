import type { MapAnalysis } from '../../utils/mapAnalyzer';
import type { ProgramBehavior } from '../../utils/programBehavior';
import type { ProjectArchitecture } from '../../utils/projectArchitecture';
import type { RuntimeTraceAnalysis } from '../../utils/runtimeTrace';
import type { ProjectSummary } from './projectSummary';

export interface ProjectAnalysisReportInput {
  projectName: string;
  generatedAt: string;
  summary: ProjectSummary;
  architecture: ProjectArchitecture | null;
  behavior: ProgramBehavior | null;
  runtimeTrace: RuntimeTraceAnalysis | null;
  mapAnalysis: MapAnalysis | null;
}

export function buildProjectAnalysisReport(input: ProjectAnalysisReportInput) {
  const { projectName, generatedAt, summary, architecture, behavior, runtimeTrace, mapAnalysis } = input;
  const riskRows = summary.findings.length ? summary.findings.map((item, index) => `${index + 1}. **${item.severity.toUpperCase()} · ${item.title}**\n   - 位置：\`${item.file}${item.line ? `:${item.line}` : ''}\`\n   - 证据：\`${item.evidence.replace(/`/g, "'")}\`\n   - 建议：${item.recommendation}`).join('\n') : '未命中当前本地规则。该结果不代表工程不存在其他问题。';
  const architectureRows = architecture ? architecture.layers.map(layer => `- **${layer.name}**：${layer.nodes.map(node => `${node.name}（${node.file}:${node.line}）`).join('、') || layer.files.join('、') || '未识别'}`).join('\n') : '未执行程序框架分析。';
  const flowEvidenceRows = architecture ? `> 注册回调：${architecture.callbacks.map(item => item.name).join('、') || '未识别'}；静态调用解析率 ${(architecture.coverage.resolvedRate * 100).toFixed(1)}% （${architecture.coverage.resolvedCallSites}/${architecture.coverage.callSites}）。` : '';
  const flowDetails = architecture?.flows.length ? architecture.flows.map(flow => `### ${flow.title}\n\n${flow.steps.map(step => `${'  '.repeat(step.depth)}- ${step.name}（${step.control === 'loop' ? '循环内' : step.control === 'branch' ? '条件分支' : step.relation}，${step.file}:${step.line}）`).join('\n')}\n\n${flow.notes.map(note => `> ${note}`).join('\n')}`).join('\n\n') : '未识别到可展开的执行流程。';
  const flowRows = [flowEvidenceRows, flowDetails].filter(Boolean).join('\n\n');
  const stateRows = behavior?.stateMachines.length ? behavior.stateMachines.map(machine => `### ${machine.name}\n\n- 状态变量：\`${machine.variable}\`\n- 状态：${machine.states.join('、')}\n${machine.transitions.map(item => `- ${item.from} → ${item.to}${item.event ? `，条件：\`${item.event}\`` : ''}（${item.file}:${item.line}）`).join('\n')}`).join('\n\n') : '未识别到状态机。';
  const concurrencyRows = behavior ? `- 任务：${behavior.tasks.map(item => `${item.name}（入口 ${item.entry || '?'}，栈 ${item.stack || '?'}，优先级 ${item.priority || '?'}）`).join('；') || '未识别'}\n- 同步资源：${behavior.resources.map(item => `${item.kind} ${item.name}（写：${item.writers.join('/') || '?'}；读：${item.readers.join('/') || '?'}）`).join('；') || '未识别'}\n- 回调：${behavior.callbacks.map(item => `${item.callback} ← ${item.api}`).join('；') || '未识别'}` : '未执行并发分析。';
  const traceRows = runtimeTrace ? `- 事件：${runtimeTrace.events.length}\n- 上下文：${runtimeTrace.contexts.join('、') || '未标记'}\n- 时间跨度：${runtimeTrace.durationMs.toFixed(3)} ms\n\n${runtimeTrace.events.slice(0, 1000).map(item => `- ${item.timestamp.toFixed(3)} · ${item.type} · ${item.name}${item.context ? ` · ${item.context}` : ''}`).join('\n')}${runtimeTrace.events.length > 1000 ? '\n\n> 报告仅列出前1000条，完整轨迹保存在本地工作区。' : ''}` : '尚未导入真实设备运行轨迹。';
  const optimizationRows = mapAnalysis?.optimizations.length ? mapAnalysis.optimizations.map((item, index) => `${index + 1}. **${item.title}**：${item.minBytes.toLocaleString()}～${item.maxBytes.toLocaleString()} 字节（${item.confidence} 可信度）\n   - 依据：${item.basis}\n   - 操作：${item.action}`).join('\n') : '没有足够的 MAP 信息量化优化空间。';
  return `# EmbedKit 工程分析报告\n\n- 工程：${projectName}\n- 生成时间：${generatedAt}\n- 芯片：${summary.chip}\n- 构建体系：${summary.toolchain}（可信度 ${summary.buildConfidence}）\n- 识别依据：${summary.buildEvidence.join('；')}\n- SDK：${summary.sdk}\n- 工程类型：${summary.projectType}\n- 文件：${summary.files}（源文件 ${summary.sourceFiles}，头文件 ${summary.headerFiles}）\n- 总行数：${summary.totalLines}\n- 入口：${summary.entryPoints.join(', ') || '未识别'}\n- 构建配置：${summary.buildFiles.join(', ') || '未识别'}\n- 外设：${summary.peripherals.join(', ') || '未识别'}\n\n## 程序执行流程\n\n- 运行模型：${architecture?.runtime ?? '未识别'}\n- 分析可信度：${architecture?.confidence ?? 'low'}\n- 任务：${architecture?.tasks.map(item => item.name).join('、') || '未识别'}\n- 中断/回调：${architecture?.interrupts.map(item => item.name).join('、') || '未识别'}\n\n${flowRows}\n\n## 状态机\n\n${stateRows}\n\n## 并发资源\n\n${concurrencyRows}\n\n## 真实设备轨迹\n\n${traceRows}\n\n## 程序分层\n\n${architectureRows}\n\n## MAP 优化空间\n\n${optimizationRows}\n\n## 本地静态风险\n\n${riskRows}\n\n## 能力边界\n\n本报告是源码、工程配置、产物和已导入运行轨迹的关联结果。优化空间是待验证区间；宏、函数指针、任务调度、中断抢占和运行时注册仍可能影响流程完整性。\n`;
}
