import { describe, expect, it } from 'vitest';
import type { MapAnalysis } from '../../utils/mapAnalyzer';
import type { ProgramBehavior } from '../../utils/programBehavior';
import type { ProjectArchitecture } from '../../utils/projectArchitecture';
import type { RuntimeTraceAnalysis } from '../../utils/runtimeTrace';
import type { ProjectSummary } from './projectSummary';
import { buildProjectAnalysisReport } from './projectAnalysisReport';

const summary = {
  chip: 'STM32F103', toolchain: 'Keil MDK', sdk: 'CMSIS', projectType: '厂商 IDE 工程', files: 3, sourceFiles: 1, headerFiles: 1,
  totalLines: 20, entryPoints: ['/main.c'], buildFiles: ['/app.uvprojx'], peripherals: ['UART'], buildConfidence: 'high',
  buildEvidence: ['发现 Keil 工程文件 /app.uvprojx'], findings: [{ id: 'risk', severity: 'high', title: '风险', file: '/main.c', line: 2, evidence: 'value `unsafe`', recommendation: '修复' }],
} as ProjectSummary;

describe('project analysis report', () => {
  it('exports deterministic evidence and explicit degradation sections', () => {
    const report = buildProjectAnalysisReport({ projectName: 'demo', generatedAt: '2026-01-01', summary, architecture: null, behavior: null, runtimeTrace: null, mapAnalysis: null });
    expect(report).toContain('- 工程：demo\n- 生成时间：2026-01-01');
    expect(report).toContain('未执行程序框架分析。');
    expect(report).toContain('尚未导入真实设备运行轨迹。');
    expect(report).toContain("证据：`value 'unsafe'`");
    expect(report).toContain('## 能力边界');
  });

  it('keeps source positions, flow coverage, runtime evidence, and MAP optimization together', () => {
    const architecture = {
      runtime: 'bare-metal', confidence: 'high', tasks: [{ name: 'main' }], interrupts: [{ name: 'IRQ' }], callbacks: [{ name: 'on_rx' }],
      coverage: { resolvedRate: 0.5, resolvedCallSites: 1, callSites: 2 }, layers: [{ name: '驱动', nodes: [{ name: 'uart_init', file: '/uart.c', line: 4 }], files: [] }],
      flows: [{ title: '启动', steps: [{ depth: 0, name: 'main', control: 'sequence', relation: 'start', file: '/main.c', line: 1 }], notes: ['静态证据'] }],
    } as unknown as ProjectArchitecture;
    const behavior = { stateMachines: [], tasks: [{ name: 'worker', entry: 'run', stack: '512', priority: '2' }], resources: [], callbacks: [] } as unknown as ProgramBehavior;
    const runtimeTrace = { events: [{ timestamp: 1, type: 'task', name: 'worker', context: 'rtos' }], contexts: ['rtos'], durationMs: 1 } as unknown as RuntimeTraceAnalysis;
    const mapAnalysis = { optimizations: [{ title: '移除未用模块', minBytes: 10, maxBytes: 20, confidence: 'medium', basis: '符号证据', action: '复核链接选项' }] } as unknown as MapAnalysis;
    const report = buildProjectAnalysisReport({ projectName: 'demo', generatedAt: 'now', summary, architecture, behavior, runtimeTrace, mapAnalysis });
    expect(report).toContain('静态调用解析率 50.0% （1/2）');
    expect(report).toContain('main（start，/main.c:1）');
    expect(report).toContain('1.000 · task · worker · rtos');
    expect(report).toContain('移除未用模块');
  });

  it('limits exported trace detail to 1000 events while retaining the total count', () => {
    const events = Array.from({ length: 1001 }, (_, index) => ({ timestamp: index, type: 'event', name: `event-${index}` }));
    const runtimeTrace = { events, contexts: [], durationMs: 1000 } as unknown as RuntimeTraceAnalysis;
    const report = buildProjectAnalysisReport({ projectName: 'demo', generatedAt: 'now', summary, architecture: null, behavior: null, runtimeTrace, mapAnalysis: null });
    expect(report).toContain('- 事件：1001');
    expect(report).toContain('event-999');
    expect(report).not.toContain('event-1000');
    expect(report).toContain('报告仅列出前1000条');
  });
});
