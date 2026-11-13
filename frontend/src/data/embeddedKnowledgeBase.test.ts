import { describe, expect, it } from 'vitest';
import { embeddedKnowledgeDocuments, knowledgeMatchSnippet, resolveEmbeddedKnowledgeLink, searchEmbeddedKnowledge } from './embeddedKnowledgeBase';

describe('embeddedKnowledgeBase', () => {
  it('bundles the complete local knowledge set with traceable sources', () => {
    expect(embeddedKnowledgeDocuments).toHaveLength(27);
    expect(new Set(embeddedKnowledgeDocuments.map(document => document.id)).size).toBe(27);
    expect(embeddedKnowledgeDocuments.every(document => document.content.startsWith('# ') && document.sourcePath.endsWith('.md'))).toBe(true);
  });

  it('searches full content and preserves platform-specific boundaries', () => {
    expect(searchEmbeddedKnowledge('ISR DMA').map(document => document.id)).toContain('mcu-rtos');
    expect(searchEmbeddedKnowledge('DMA 物理位映射').map(document => document.id)).toContain('linux-problem-review');
    expect(searchEmbeddedKnowledge('', 'AI 约束').map(document => document.id)).toEqual([
      'ai-constraints', 'ai-startup-protocol', 'ai-task-routing', 'ai-gate-evidence', 'ai-stop-authorization', 'ai-handoff-status',
      'ai-execution-rules', 'ai-project-inputs', 'ai-requirements-architecture', 'ai-detailed-design',
      'ai-software-standard', 'ai-hardware-standard', 'ai-verification-standard', 'ai-project-variables',
      'ai-deliverable-templates', 'ai-project-directory-framework',
    ]);
    expect(knowledgeMatchSnippet(embeddedKnowledgeDocuments.find(document => document.id === 'linux-problem-review')!, '物理位映射')).toContain('物理位映射');
  });

  it('publishes AI work constraints for the full project, software, and PCB workflows', () => {
    const constraints = embeddedKnowledgeDocuments.filter(document => document.category === 'AI 约束');
    expect(constraints).toHaveLength(16);
    expect(constraints.find(document => document.id === 'ai-constraints')?.content).toContain('首次使用闭环');
    expect(constraints.find(document => document.id === 'ai-constraints')?.content).toContain('约束包初始化确认');
    expect(constraints.find(document => document.id === 'ai-startup-protocol')?.content).toContain('S0 接收');
    expect(constraints.find(document => document.id === 'ai-startup-protocol')?.content).toContain('S8 交接');
    expect(constraints.find(document => document.id === 'ai-startup-protocol')?.content).toContain('M-STATUS-001');
    expect(constraints.find(document => document.id === 'ai-startup-protocol')?.content).toContain('M-CONFLICT-001');
    expect(constraints.find(document => document.id === 'ai-task-routing')?.content).toContain('项目类型裁剪矩阵');
    expect(constraints.find(document => document.id === 'ai-gate-evidence')?.content).toContain('F0 输入立项');
    expect(constraints.find(document => document.id === 'ai-gate-evidence')?.content).toContain('B4 阻塞发布');
    expect(constraints.find(document => document.id === 'ai-stop-authorization')?.content).toContain('S-AUTH-008');
    expect(constraints.find(document => document.id === 'ai-handoff-status')?.content).toContain('M-PACK-004');
    expect(constraints.find(document => document.id === 'ai-task-routing')?.content).toContain('M-START-001');
    expect(constraints.find(document => document.id === 'ai-stop-authorization')?.content).toContain('M-DEC-001');
    expect(constraints.find(document => document.id === 'ai-stop-authorization')?.content).toContain('工程师恢复动作');
    expect(constraints.find(document => document.id === 'ai-project-inputs')?.content).toContain('M-IN-001');
    expect(constraints.find(document => document.id === 'ai-project-inputs')?.content).toContain('M-IN-007');
    expect(constraints.find(document => document.id === 'ai-requirements-architecture')?.content).toContain('M-REQ-001');
    expect(constraints.find(document => document.id === 'ai-detailed-design')?.content).toContain('M-FLOW-005');
    expect(constraints.find(document => document.id === 'ai-verification-standard')?.content).toContain('Bring-up顺序');
    expect(constraints.find(document => document.id === 'ai-software-standard')?.content).toContain('M-SW-DMA-001');
    expect(constraints.find(document => document.id === 'ai-hardware-standard')?.content).toContain('M-HW-PCB-001');
    expect(constraints.find(document => document.id === 'ai-verification-standard')?.content).toContain('M-VER-001');
    expect(constraints.find(document => document.id === 'ai-verification-standard')?.content).toContain('M-VER-009');
    expect(constraints.find(document => document.id === 'ai-project-variables')?.content).toContain('未知项处理表');
    expect(constraints.find(document => document.id === 'ai-deliverable-templates')?.content).toContain('TPL-01');
    expect(constraints.find(document => document.id === 'ai-handoff-status')?.content).toContain('最少必填');
    expect(constraints.find(document => document.id === 'ai-project-directory-framework')?.content).toContain('工程师最小启动集');
    expect(constraints.find(document => document.id === 'ai-stop-authorization')?.content).toContain('必须由责任人批准');
  });

  it('resolves internal markdown links without turning repository paths into web URLs', () => {
    const overview = embeddedKnowledgeDocuments[0];
    expect(resolveEmbeddedKnowledgeLink(overview, '02-MCU与RTOS开发.md')?.id).toBe('mcu-rtos');
    expect(resolveEmbeddedKnowledgeLink(overview, '../AI嵌入式开发约束.md')?.id).toBe('ai-constraints');
    const aiOverview = embeddedKnowledgeDocuments.find(document => document.id === 'ai-constraints')!;
    expect(resolveEmbeddedKnowledgeLink(aiOverview, '02-项目输入与立项.md')?.id).toBe('ai-project-inputs');
    expect(resolveEmbeddedKnowledgeLink(aiOverview, '03-需求与架构.md')?.id).toBe('ai-requirements-architecture');
    expect(resolveEmbeddedKnowledgeLink(aiOverview, '04-详细设计.md')?.id).toBe('ai-detailed-design');
    expect(resolveEmbeddedKnowledgeLink(aiOverview, '05-软件实现.md')?.id).toBe('ai-software-standard');
    expect(resolveEmbeddedKnowledgeLink(aiOverview, '00-AI项目启动与推进协议.md')?.id).toBe('ai-startup-protocol');
    expect(resolveEmbeddedKnowledgeLink(aiOverview, '00A-任务定级与路由.md')?.id).toBe('ai-task-routing');
    expect(resolveEmbeddedKnowledgeLink(aiOverview, '00B-门禁与证据总表.md')?.id).toBe('ai-gate-evidence');
    expect(resolveEmbeddedKnowledgeLink(aiOverview, '00C-停止规则与授权边界.md')?.id).toBe('ai-stop-authorization');
    expect(resolveEmbeddedKnowledgeLink(aiOverview, '00D-交接包与状态模板.md')?.id).toBe('ai-handoff-status');
    expect(resolveEmbeddedKnowledgeLink(aiOverview, '09-交付物模板库.md')?.id).toBe('ai-deliverable-templates');
    expect(resolveEmbeddedKnowledgeLink(aiOverview, '10-项目目录框架.md')?.id).toBe('ai-project-directory-framework');
    expect(resolveEmbeddedKnowledgeLink(overview, 'https://example.com')).toBeUndefined();
  });
});
