import { beforeEach, describe, expect, it } from 'vitest';
import { createBuildAnalysisReport, listBuildAnalysisRecords, parseBuildArtifactRouteState, routeStateContext, saveBuildAnalysisRecord } from './buildAnalysisRecords';

const context = { buildId: 'build-1', artifactIndex: 2, fileName: 'D:\\secret\\app.elf', artifactType: 'elf', size: 4096, modifiedAt: '2026-10-12T00:00:00.000Z', sha256: 'a'.repeat(64) };
describe('versioned build analysis records', () => {
  beforeEach(() => localStorage.clear());
  it('stores only a bounded, path-free summary and replaces the same artifact result', () => {
    saveBuildAnalysisRecord(context, 'elf', { summary: { machine: 'Arm', symbols: 8 } }, '2026-10-12T00:00:01.000Z');
    saveBuildAnalysisRecord(context, 'elf', { error: 'invalid ELF' }, '2026-10-12T00:00:02.000Z');
    const records = listBuildAnalysisRecords('build-1');
    expect(records).toHaveLength(1); expect(records[0]).toMatchObject({ fileName: 'app.elf', status: 'failed', error: 'invalid ELF' });
    expect(localStorage.getItem('embedkit.build-analysis-records')).not.toContain('D:\\\\secret');
  });
  it('creates a portable combined report with success and failure counts', () => {
    saveBuildAnalysisRecord(context, 'elf', { summary: { symbols: 8 } });
    saveBuildAnalysisRecord({ ...context, artifactIndex: 3, fileName: 'app.map', artifactType: 'map' }, 'map', { error: 'unknown format' });
    const report = createBuildAnalysisReport('build-1', '2026-10-12T00:00:03.000Z');
    expect(report.summary).toEqual({ artifacts: 2, passed: 1, failed: 1, associations: 1 });
    expect(report.associations[0]).toMatchObject({ artifactIds: ['build-1:3', 'build-1:2'], basis: 'same-build-id-and-filename-stem', confidence: 'medium' });
  });
  it('validates route state and degrades when old state lacks association metadata', () => {
    const state = parseBuildArtifactRouteState({ selectionId: 'token', fileName: 'app.elf', source: 'build-artifact' });
    expect(state?.selectionId).toBe('token'); expect(routeStateContext(state)).toBeNull();
    expect(parseBuildArtifactRouteState({ selectionId: '', fileName: 'app.elf', source: 'build-artifact' })).toBeNull();
  });
});
