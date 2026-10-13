import { describe, expect, it } from 'vitest';
import {
  normalizeEvidenceReferences,
  normalizeFindings,
  parseEvidenceReference,
  parseFinding,
} from './evidenceModel';

describe('common evidence model', () => {
  it('accepts a versioned portable source reference', () => {
    expect(parseEvidenceReference({
      schemaVersion: 1,
      id: 'evidence-1',
      kind: 'source',
      origin: 'deterministic',
      sourceId: 'workspace-1',
      label: '调用点',
      capturedAt: '2026-10-13T00:00:00.000Z',
      sha256: 'a'.repeat(64),
      location: { file: 'src/main.c', line: 42, address: '0x08000100' },
    })).toEqual(expect.objectContaining({
      id: 'evidence-1',
      sha256: 'a'.repeat(64),
      location: { file: 'src/main.c', line: 42, address: '0x08000100' },
    }));
  });

  it('rejects unknown schemas and strips absolute or parent-traversing paths', () => {
    expect(parseEvidenceReference({ schemaVersion: 2 })).toBeNull();
    const base = {
      schemaVersion: 1,
      kind: 'log',
      origin: 'captured',
      sourceId: 'run-1',
      label: '日志',
    };
    expect(parseEvidenceReference({ ...base, id: 'absolute', location: { file: 'D:\\secret\\log.txt', logLine: 3 } })?.location).toEqual({ logLine: 3 });
    expect(parseEvidenceReference({ ...base, id: 'traversal', location: { file: '../secret.txt' } })?.location).toBeUndefined();
  });

  it('deduplicates valid evidence and rejects malformed identifiers', () => {
    const valid = { schemaVersion: 1, id: 'event-1', kind: 'communication', origin: 'captured', sourceId: 'session-1', label: 'RX' };
    expect(normalizeEvidenceReferences([valid, valid, { ...valid, id: '../bad' }])).toHaveLength(1);
  });

  it('keeps deterministic and external AI conclusions distinguishable', () => {
    const deterministic = parseFinding({
      schemaVersion: 1,
      id: 'finding-1',
      category: 'fault',
      severity: 'error',
      conclusionType: 'deterministic',
      confidence: 'high',
      summary: 'PC 位于已知函数范围内',
      evidenceIds: ['evidence-1'],
      unknowns: [],
      verificationSteps: ['复测故障地址'],
    });
    const external = { ...deterministic, id: 'finding-2', conclusionType: 'external-ai' };
    expect(normalizeFindings([deterministic, external]).map(item => item.conclusionType)).toEqual(['deterministic', 'external-ai']);
  });

  it('rejects findings without a valid conclusion contract', () => {
    expect(parseFinding({ schemaVersion: 1, id: 'finding-1', summary: 'missing fields' })).toBeNull();
  });
});
