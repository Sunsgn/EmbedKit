import { describe, expect, it } from 'vitest';
import { embeddedKnowledgeDocuments, knowledgeMatchSnippet, resolveEmbeddedKnowledgeLink, searchEmbeddedKnowledge } from './embeddedKnowledgeBase';

describe('embeddedKnowledgeBase', () => {
  it('bundles the complete local knowledge set with traceable sources', () => {
    expect(embeddedKnowledgeDocuments).toHaveLength(12);
    expect(new Set(embeddedKnowledgeDocuments.map(document => document.id)).size).toBe(12);
    expect(embeddedKnowledgeDocuments.every(document => document.content.startsWith('# ') && document.sourcePath.endsWith('.md'))).toBe(true);
  });

  it('searches full content and preserves platform-specific boundaries', () => {
    expect(searchEmbeddedKnowledge('ISR DMA').map(document => document.id)).toContain('mcu-rtos');
    expect(searchEmbeddedKnowledge('DMA 物理位映射').map(document => document.id)).toContain('linux-problem-review');
    expect(searchEmbeddedKnowledge('', 'AI 约束').map(document => document.id)).toEqual(['ai-constraints']);
    expect(knowledgeMatchSnippet(embeddedKnowledgeDocuments.find(document => document.id === 'linux-problem-review')!, '物理位映射')).toContain('物理位映射');
  });

  it('resolves internal markdown links without turning repository paths into web URLs', () => {
    const overview = embeddedKnowledgeDocuments[0];
    expect(resolveEmbeddedKnowledgeLink(overview, '02-MCU与RTOS开发.md')?.id).toBe('mcu-rtos');
    expect(resolveEmbeddedKnowledgeLink(overview, '../AI嵌入式开发约束.md')?.id).toBe('ai-constraints');
    expect(resolveEmbeddedKnowledgeLink(overview, 'https://example.com')).toBeUndefined();
  });
});
