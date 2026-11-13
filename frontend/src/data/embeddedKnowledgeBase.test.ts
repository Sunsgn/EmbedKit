import { describe, expect, it } from 'vitest';
import { embeddedKnowledgeDocuments, knowledgeMatchSnippet, resolveEmbeddedKnowledgeLink, searchEmbeddedKnowledge } from './embeddedKnowledgeBase';

describe('embeddedKnowledgeBase', () => {
  it('bundles the complete local knowledge set with traceable sources', () => {
    expect(embeddedKnowledgeDocuments).toHaveLength(22);
    expect(new Set(embeddedKnowledgeDocuments.map(document => document.id)).size).toBe(22);
    expect(embeddedKnowledgeDocuments.every(document => document.content.startsWith('# ') && document.sourcePath.endsWith('.md'))).toBe(true);
  });

  it('searches full content and preserves platform-specific boundaries', () => {
    expect(searchEmbeddedKnowledge('ISR DMA').map(document => document.id)).toContain('mcu-rtos');
    expect(searchEmbeddedKnowledge('DMA 物理位映射').map(document => document.id)).toContain('linux-problem-review');
    expect(searchEmbeddedKnowledge('', 'AI 约束').map(document => document.id)).toEqual([
      'ai-constraints', 'ai-startup-protocol', 'ai-execution-rules', 'ai-project-inputs', 'ai-project-workflow', 'ai-software-standard',
      'ai-hardware-standard', 'ai-verification-standard', 'ai-project-variables', 'ai-deliverable-templates', 'ai-gate-directory-map',
    ]);
    expect(knowledgeMatchSnippet(embeddedKnowledgeDocuments.find(document => document.id === 'linux-problem-review')!, '物理位映射')).toContain('物理位映射');
  });

  it('publishes AI work constraints for the full project, software, and PCB workflows', () => {
    const constraints = embeddedKnowledgeDocuments.filter(document => document.category === 'AI 约束');
    expect(constraints).toHaveLength(11);
    expect(constraints.find(document => document.id === 'ai-constraints')?.content).toContain('任务类型与必读分册');
    expect(constraints.find(document => document.id === 'ai-constraints')?.content).toContain('T0 只读');
    expect(constraints.find(document => document.id === 'ai-startup-protocol')?.content).toContain('S0 接收');
    expect(constraints.find(document => document.id === 'ai-startup-protocol')?.content).toContain('S8 交接');
    expect(constraints.find(document => document.id === 'ai-startup-protocol')?.content).toContain('M-STATUS-001');
    expect(constraints.find(document => document.id === 'ai-execution-rules')?.content).toContain('M-START-001');
    expect(constraints.find(document => document.id === 'ai-execution-rules')?.content).toContain('M-DEC-001');
    expect(constraints.find(document => document.id === 'ai-execution-rules')?.content).toContain('工程师恢复动作');
    expect(constraints.find(document => document.id === 'ai-project-inputs')?.content).toContain('M-IN-001');
    expect(constraints.find(document => document.id === 'ai-project-inputs')?.content).toContain('M-IN-007');
    expect(constraints.find(document => document.id === 'ai-project-inputs')?.content).toContain('G0 概念评估');
    expect(constraints.find(document => document.id === 'ai-project-inputs')?.content).toContain('B4 阻塞发布');
    expect(constraints.find(document => document.id === 'ai-project-workflow')?.content).toContain('板级 Bring-up');
    expect(constraints.find(document => document.id === 'ai-project-workflow')?.content).toContain('M-FLOW-005');
    expect(constraints.find(document => document.id === 'ai-software-standard')?.content).toContain('M-SW-DMA-001');
    expect(constraints.find(document => document.id === 'ai-hardware-standard')?.content).toContain('M-HW-PCB-001');
    expect(constraints.find(document => document.id === 'ai-verification-standard')?.content).toContain('M-VER-001');
    expect(constraints.find(document => document.id === 'ai-verification-standard')?.content).toContain('M-VER-009');
    expect(constraints.find(document => document.id === 'ai-project-variables')?.content).toContain('未知项处理表');
    expect(constraints.find(document => document.id === 'ai-deliverable-templates')?.content).toContain('TPL-01');
    expect(constraints.find(document => document.id === 'ai-deliverable-templates')?.content).toContain('TPL-11');
    expect(constraints.find(document => document.id === 'ai-deliverable-templates')?.content).toContain('最少必填字段');
    expect(constraints.find(document => document.id === 'ai-gate-directory-map')?.content).toContain('F0 输入立项');
    expect(constraints.find(document => document.id === 'ai-gate-directory-map')?.content).toContain('G0 概念评估');
    expect(constraints.find(document => document.id === 'ai-gate-directory-map')?.content).toContain('E0 静态');
    expect(constraints.find(document => document.id === 'ai-execution-rules')?.content).toContain('AI 不得自行批准采购、打样、试产、量产');
  });

  it('resolves internal markdown links without turning repository paths into web URLs', () => {
    const overview = embeddedKnowledgeDocuments[0];
    expect(resolveEmbeddedKnowledgeLink(overview, '02-MCU与RTOS开发.md')?.id).toBe('mcu-rtos');
    expect(resolveEmbeddedKnowledgeLink(overview, '../AI嵌入式开发约束.md')?.id).toBe('ai-constraints');
    const aiOverview = embeddedKnowledgeDocuments.find(document => document.id === 'ai-constraints')!;
    expect(resolveEmbeddedKnowledgeLink(aiOverview, '01A-项目输入与立项.md')?.id).toBe('ai-project-inputs');
    expect(resolveEmbeddedKnowledgeLink(aiOverview, '03-软件编程技术规范.md')?.id).toBe('ai-software-standard');
    expect(resolveEmbeddedKnowledgeLink(aiOverview, '00-AI项目启动与推进协议.md')?.id).toBe('ai-startup-protocol');
    expect(resolveEmbeddedKnowledgeLink(aiOverview, '07-交付物模板库.md')?.id).toBe('ai-deliverable-templates');
    expect(resolveEmbeddedKnowledgeLink(aiOverview, '08-阶段门禁与目录映射表.md')?.id).toBe('ai-gate-directory-map');
    expect(resolveEmbeddedKnowledgeLink(overview, 'https://example.com')).toBeUndefined();
  });
});
