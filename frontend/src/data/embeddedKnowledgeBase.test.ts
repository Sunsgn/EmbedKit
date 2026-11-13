import { describe, expect, it } from 'vitest';
import { embeddedKnowledgeDocuments, knowledgeMatchSnippet, resolveEmbeddedKnowledgeLink, searchEmbeddedKnowledge } from './embeddedKnowledgeBase';

describe('embeddedKnowledgeBase', () => {
  it('bundles the complete local knowledge set with traceable sources', () => {
    expect(embeddedKnowledgeDocuments).toHaveLength(18);
    expect(new Set(embeddedKnowledgeDocuments.map(document => document.id)).size).toBe(18);
    expect(embeddedKnowledgeDocuments.every(document => document.content.startsWith('# ') && document.sourcePath.endsWith('.md'))).toBe(true);
  });

  it('searches full content and preserves platform-specific boundaries', () => {
    expect(searchEmbeddedKnowledge('ISR DMA').map(document => document.id)).toContain('mcu-rtos');
    expect(searchEmbeddedKnowledge('DMA 物理位映射').map(document => document.id)).toContain('linux-problem-review');
    expect(searchEmbeddedKnowledge('', 'AI 约束').map(document => document.id)).toEqual([
      'ai-constraints', 'ai-execution-rules', 'ai-project-workflow', 'ai-software-standard',
      'ai-hardware-standard', 'ai-verification-standard', 'ai-project-variables',
    ]);
    expect(knowledgeMatchSnippet(embeddedKnowledgeDocuments.find(document => document.id === 'linux-problem-review')!, '物理位映射')).toContain('物理位映射');
  });

  it('publishes AI work constraints for the full project, software, and PCB workflows', () => {
    const constraints = embeddedKnowledgeDocuments.filter(document => document.category === 'AI 约束');
    expect(constraints).toHaveLength(7);
    expect(constraints.find(document => document.id === 'ai-constraints')?.content).toContain('任务类型与必读分册');
    expect(constraints.find(document => document.id === 'ai-project-workflow')?.content).toContain('板级 Bring-up');
    expect(constraints.find(document => document.id === 'ai-software-standard')?.content).toContain('软件编程技术规范');
    expect(constraints.find(document => document.id === 'ai-hardware-standard')?.content).toContain('原理图与 PCB 设计规范');
    expect(constraints.find(document => document.id === 'ai-execution-rules')?.content).toContain('AI 不得自行批准采购、打样、量产');
  });

  it('resolves internal markdown links without turning repository paths into web URLs', () => {
    const overview = embeddedKnowledgeDocuments[0];
    expect(resolveEmbeddedKnowledgeLink(overview, '02-MCU与RTOS开发.md')?.id).toBe('mcu-rtos');
    expect(resolveEmbeddedKnowledgeLink(overview, '../AI嵌入式开发约束.md')?.id).toBe('ai-constraints');
    const aiOverview = embeddedKnowledgeDocuments.find(document => document.id === 'ai-constraints')!;
    expect(resolveEmbeddedKnowledgeLink(aiOverview, '03-软件编程技术规范.md')?.id).toBe('ai-software-standard');
    expect(resolveEmbeddedKnowledgeLink(overview, 'https://example.com')).toBeUndefined();
  });
});
