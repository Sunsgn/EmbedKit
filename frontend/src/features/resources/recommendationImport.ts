import type { PartRecord } from '../../types';

export const RECOMMENDATION_TEXT_LIMIT = 64 * 1024;
export const RECOMMENDATION_CANDIDATE_LIMIT = 30;

export interface RecommendationCandidate {
  id: string;
  model: string;
  lineNumber: number;
  excerpt: string;
  confidence: 'high' | 'review';
}

export interface RecommendationParseResult {
  candidates: RecommendationCandidate[];
  warnings: string[];
}

const normalizedModel = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
const excluded = /^(?:cortex|armv|riscv|freertos|threadx|rtos|canfd|uart|usart|spi|i2c|flash|sram|ram|lqfp\d*|qfn\d*|bga\d*|v\d+)$/i;
const measurement = /^\d+(?:\.\d+)?(?:v|mv|ma|ua|a|w|mw|hz|khz|mhz|ghz|b|kb|mb|gb|c|°c|k)$/i;

export function parseRecommendationText(input: string): RecommendationParseResult {
  const text = input.slice(0, RECOMMENDATION_TEXT_LIMIT), warnings: string[] = [];
  if (input.length > RECOMMENDATION_TEXT_LIMIT) warnings.push('输入超过 64 KiB，已只解析前 64 KiB');
  const found = new Map<string, RecommendationCandidate>();
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    const tokens = line.match(/[A-Za-z0-9][A-Za-z0-9._+\-/]{3,63}/g) ?? [];
    for (const token of tokens) {
      const model = token.replace(/[.,;:]+$/, '');
      if (!/[A-Za-z]/.test(model) || !/\d/.test(model) || excluded.test(model) || measurement.test(model) || /^https?/i.test(model)) continue;
      const key = normalizedModel(model);
      if (key.length < 5 || found.has(key)) continue;
      const digitCount = (model.match(/\d/g) ?? []).length;
      found.set(key, { id: key, model, lineNumber: index + 1, excerpt: line.slice(0, 300), confidence: digitCount >= 2 && model.length >= 6 ? 'high' : 'review' });
      if (found.size === RECOMMENDATION_CANDIDATE_LIMIT) break;
    }
    if (found.size === RECOMMENDATION_CANDIDATE_LIMIT) { warnings.push(`候选超过 ${RECOMMENDATION_CANDIDATE_LIMIT} 个，只保留前 ${RECOMMENDATION_CANDIDATE_LIMIT} 个`); break; }
  }
  return { candidates: [...found.values()], warnings };
}

export function isExactRecommendationMatch(query: string, productName: string) {
  const target = normalizedModel(query);
  return (productName.match(/[A-Za-z0-9][A-Za-z0-9._+\-/]{3,127}/g) ?? []).some(token => normalizedModel(token) === target);
}

export function attachRecommendationEvidence(part: PartRecord, candidate: RecommendationCandidate, importId: string): PartRecord {
  const sourceId = `user-import:${importId}`, evidenceId = `${part.id}:recommendation:${importId}`, retrievedAt = new Date().toISOString();
  return {
    ...part,
    sources: [...part.sources.filter(source => source.id !== sourceId), { id: sourceId, kind: 'user-import', name: '用户粘贴的候选推荐' }],
    evidence: [...part.evidence.filter(evidence => evidence.id !== evidenceId), { id: evidenceId, sourceId, retrievedAt, note: `推荐文本第 ${candidate.lineNumber} 行出现型号 ${candidate.model}；该文本只证明候选来源，不作为器件参数证据。原文摘要：${candidate.excerpt}` }],
    updatedAt: retrievedAt,
  };
}
