import { describe, expect, it } from 'vitest';
import type { DocumentExtractionResult } from '../../tools/frame/documentExtraction';
import { analyzeDatasheetExtraction, parsePdfPageEvidence, searchDatasheetPages } from './datasheetAnalysis';

const result: DocumentExtractionResult = { schema: 'embedkit.document-extraction', version: 1, fileName: 'part.pdf', kind: 'pdf', fileBytes: 1000, extractedAt: '2026-10-21T00:00:00.000Z', units: 3, unitLabel: '页', warnings: [], text: '[[来源:PDF 第 1 页]]\n1 Features\nLow quiescent current\nApplications\nIndustrial power\n[[来源:PDF 第 2 页]]\n5 Pin Configuration and Functions\nVIN input supply\n[[来源:PDF 第 3 页]]\n7 Electrical Characteristics\nSupply current 2 mA\nLayout Guidelines\nKeep the loop short' };

describe('datasheet evidence analysis', () => {
  it('preserves page boundaries and recognizes common datasheet sections', () => {
    expect(parsePdfPageEvidence(result.text)).toHaveLength(3);
    const analysis = analyzeDatasheetExtraction(result);
    expect(analysis.sections.map(section => section.kind)).toEqual(['features', 'applications', 'pinout', 'electrical', 'layout']);
    expect(analysis.sections.find(section => section.kind === 'pinout')).toMatchObject({ page: 2, evidence: 'PDF 第 2 页' });
    expect(analysis.coverage).toBe(45);
    expect(analysis.unknownSections).toContain('时序要求');
  });

  it('returns bounded page-level full-text matches', () => {
    const matches = searchDatasheetPages(parsePdfPageEvidence(result.text), 'supply', 1);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ page: 2, evidence: 'PDF 第 2 页' });
    expect(searchDatasheetPages(parsePdfPageEvidence(result.text), 'x')).toEqual([]);
  });
});
