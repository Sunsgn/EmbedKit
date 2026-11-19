import type { ProjectArchitecture } from '../utils/projectArchitecture';
import type { ProgramBehavior } from '../utils/programBehavior';
import { PROJECT_ANALYSIS_RUN_SCHEMA_VERSION, type ProjectAnalysisFinding, type ProjectAnalysisRun } from '../types/projectAnalysis';

interface RiskFinding {
  severity: 'low' | 'medium' | 'high';
  title: string;
  file: string;
  line: number;
  evidence: string;
  recommendation: string;
}

const categoryFor = (finding: RiskFinding): ProjectAnalysisFinding['category'] => {
  const value = `${finding.title} ${finding.recommendation}`;
  if (/越界|注入|密钥|密码|安全|校验/i.test(value)) return 'security';
  if (/内存|堆|栈|malloc|free|溢出/i.test(value)) return 'memory';
  if (/阻塞|延时|性能|循环|吞吐/i.test(value)) return 'performance';
  if (/结构|重复|复杂|命名|维护/i.test(value)) return 'maintainability';
  return 'reliability';
};

export function createCompletedProjectAnalysisRun(input: {
  projectId: string;
  projectRevisionId: string;
  sourceFingerprint: string;
  inputFingerprint: string;
  architecture: ProjectArchitecture;
  behavior: ProgramBehavior;
  findings: RiskFinding[];
  runtimeEvents: number;
  runtimeRate?: number;
  startedAt?: string;
  finishedAt?: string;
}): ProjectAnalysisRun {
  const startedAt = input.startedAt ?? new Date().toISOString(), finishedAt = input.finishedAt ?? new Date().toISOString();
  const frameworkEvidence = input.architecture.evidence.slice(0, 500).map((message, index) => ({ id: `evidence:framework:${index}`, kind: 'project-config' as const, message, confidence: input.architecture.confidence }));
  const sourceEvidence = input.findings.slice(0, 1000).map((finding, index) => ({ id: `evidence:finding:${index}`, kind: 'source' as const, message: finding.evidence || finding.title, confidence: 'high' as const, file: finding.file, ...(finding.line > 0 ? { line: finding.line } : {}) }));
  const calculationEvidence = [{ id: 'evidence:coverage', kind: 'calculation' as const, message: `解析 ${input.architecture.coverage.parsedFunctions} 个函数，调用点 ${input.architecture.coverage.resolvedCallSites}/${input.architecture.coverage.callSites}`, confidence: input.architecture.confidence }];
  const runtimeEvidence = input.runtimeEvents > 0 ? [{ id: 'evidence:runtime', kind: 'runtime' as const, message: `导入 ${input.runtimeEvents} 条真实运行事件${input.runtimeRate === undefined ? '' : `，静态流程覆盖率 ${(input.runtimeRate * 100).toFixed(1)}%`}`, confidence: 'high' as const }] : [];
  const evidence = [...frameworkEvidence, ...sourceEvidence, ...calculationEvidence, ...runtimeEvidence];
  const findings = input.findings.slice(0, 1000).map((finding, index) => ({ id: `finding:${index}`, severity: finding.severity, category: categoryFor(finding), title: finding.title, recommendation: finding.recommendation, evidenceIds: [`evidence:finding:${index}`] }));
  const unknowns = [
    input.architecture.entries.length === 0 && '未识别到程序入口；可能由宏、汇编或生成代码提供。',
    input.architecture.unknownCalls > 0 && `${input.architecture.unknownCalls} 个外部库、宏或函数指针调用未展开。`,
    input.architecture.ambiguities.length > 0 && `${input.architecture.ambiguities.length} 个同名定义存在歧义，未自动连接。`,
    !input.behavior.metadata.compileCommands && '未发现 compile_commands.json，类型、宏和条件编译路径无法精确还原。',
    input.runtimeEvents === 0 && '尚未导入真实设备运行轨迹，当前结论属于静态分析。',
  ].filter(Boolean) as string[];
  return {
    schemaVersion: PROJECT_ANALYSIS_RUN_SCHEMA_VERSION,
    id: `analysis:${crypto.randomUUID()}`,
    projectId: input.projectId,
    projectRevisionId: input.projectRevisionId,
    sourceFingerprint: input.sourceFingerprint,
    inputFingerprint: input.inputFingerprint,
    dirty: input.inputFingerprint !== input.sourceFingerprint,
    status: 'completed',
    startedAt,
    finishedAt,
    analyzer: { name: 'embedkit-deterministic-project-analysis', version: '1.0.0' },
    framework: { name: input.architecture.runtime, confidence: input.architecture.confidence, evidenceIds: frameworkEvidence.map(item => item.id) },
    coverage: { ...input.architecture.coverage, runtimeEvents: input.runtimeEvents, ...(input.runtimeRate === undefined ? {} : { runtimeRate: input.runtimeRate }) },
    findings,
    unknowns,
    evidence,
  };
}

export function exportProjectAnalysisRun(run: ProjectAnalysisRun) {
  const payload = JSON.stringify({ schema: 'embedkit.project-analysis-report', version: 1, exportedAt: new Date().toISOString(), run }, null, 2);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([payload], { type: 'application/json;charset=utf-8' }));
  link.download = `embedkit-analysis-${run.projectId}-${run.finishedAt.replace(/[:.]/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}
