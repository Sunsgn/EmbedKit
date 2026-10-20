import { describe, expect, it } from 'vitest';
import type { PartRecord } from '../../types';
import { attachRecommendationEvidence, isExactRecommendationMatch, parseRecommendationText } from './recommendationImport';

const part: PartRecord = { schemaVersion: 1, id: 'online:stm32g474ret6', manufacturer: 'ST', mpn: 'STM32G474RET6', category: 'MCU', subcategory: 'MCU', description: 'test', tags: [], variants: [{ mpn: 'STM32G474RET6', lifecycle: 'active' }], parameters: [], documents: [], sources: [{ id: 'online', kind: 'aggregator', name: 'source' }], evidence: [], createdAt: '', updatedAt: '' };

describe('recommendation candidate import', () => {
  it('extracts and deduplicates part numbers from prose, lists, and markdown tables', () => {
    const result = parseRecommendationText(`推荐以下器件：\n- STM32G474RET6：支持 CAN FD，主频 170MHz\n| 型号 | 厂商 |\n| S32K144 | NXP |\n备选仍可考虑 stm32g474ret6。`);
    expect(result.candidates.map(item => item.model)).toEqual(['STM32G474RET6', 'S32K144']);
    expect(result.candidates.every(item => !['170MHz', 'CAN'].includes(item.model))).toBe(true);
  });

  it('requires an exact model token rather than accepting a related ordering suffix', () => {
    expect(isExactRecommendationMatch('TCAN1042', 'TCAN1042 CAN transceiver')).toBe(true);
    expect(isExactRecommendationMatch('TCAN1042', 'TCAN1042-Q1 automotive transceiver')).toBe(false);
  });

  it('attaches bounded local recommendation provenance to a verified lookup result', () => {
    const candidate = parseRecommendationText('- STM32G474RET6 推荐用于电机控制').candidates[0];
    const result = attachRecommendationEvidence(part, candidate, 'batch-1');
    expect(result.sources.at(-1)).toMatchObject({ kind: 'user-import', name: '用户粘贴的候选推荐' });
    expect(result.evidence.at(-1)?.note).toContain('只证明候选来源，不作为器件参数证据');
  });
});
