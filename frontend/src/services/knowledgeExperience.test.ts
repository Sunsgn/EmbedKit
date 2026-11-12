import { describe, expect, it } from 'vitest';
import { createKnowledgeExperienceLibrary, KNOWLEDGE_EXPERIENCE_LIMIT, parseKnowledgeExperienceLibrary, searchKnowledgeExperiences, upsertKnowledgeExperience, type KnowledgeExperienceRecord } from './knowledgeExperience';

const draft = (patch: Partial<KnowledgeExperienceRecord> = {}): KnowledgeExperienceRecord => ({
  schemaVersion: 1, id: 'uart-timeout', title: 'UART 间歇性超时', symptom: '高吞吐时接收停止', context: '通用 UART DMA 接收', applicability: '带 DMA 和空闲中断的 MCU', possibleCauses: ['DMA 未重装'], diagnosticSteps: ['保存 DMA 计数器'], resolutionSteps: ['在完成中断重装 DMA'], rollbackSteps: ['恢复轮询接收'], retestSteps: [], evidenceReferences: [], status: 'draft', createdAt: '2026-11-12T00:00:00.000Z', updatedAt: '2026-11-12T00:00:00.000Z', ...patch,
});

describe('knowledge experience library', () => {
  it('requires retest evidence before an experience can be verified', () => {
    expect(() => upsertKnowledgeExperience({ ...draft({ status: 'verified' }), createdAt: undefined }, [])).toThrow(/证据引用和复测步骤/);
    expect(upsertKnowledgeExperience({ ...draft({ status: 'verified', evidenceReferences: ['session:uart-1'], retestSteps: ['连续运行 24 小时'] }), createdAt: undefined }, [])[0].status).toBe('verified');
  });

  it('exports, imports and searches structured records without losing traceability', () => {
    const library = createKnowledgeExperienceLibrary([draft({ evidenceReferences: ['report:42'] })]);
    const parsed = parseKnowledgeExperienceLibrary(JSON.stringify(library));
    expect(searchKnowledgeExperiences(parsed.records, 'DMA 高吞吐')).toHaveLength(1);
    expect(parsed.records[0].evidenceReferences).toEqual(['report:42']);
  });

  it('rejects unknown versions, duplicate IDs and excessive collections', () => {
    expect(() => parseKnowledgeExperienceLibrary('{"schema":"embedkit.knowledge-experiences","version":2,"records":[]}')).toThrow(/版本/);
    expect(() => createKnowledgeExperienceLibrary([draft(), draft()])).toThrow(/重复 ID/);
    expect(() => createKnowledgeExperienceLibrary(Array.from({ length: KNOWLEDGE_EXPERIENCE_LIMIT + 1 }, (_, index) => draft({ id: String(index) })))).toThrow(/上限/);
  });

  it('requires invalidated records to point to their replacement', () => {
    expect(() => createKnowledgeExperienceLibrary([draft({ status: 'invalidated' })])).toThrow(/替代记录 ID/);
  });
});
