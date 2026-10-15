import { describe, expect, it } from 'vitest';
import {
  normalizeLifecycleRecords,
  parseBuildArtifact,
  parseCommunicationSession,
  parseFirmwareIdentity,
  parseProjectRevision,
} from './lifecycleModel';

const digest = 'ab'.repeat(32);

describe('lifecycle public model', () => {
  it('normalizes a portable project revision without assuming a toolchain', () => {
    expect(parseProjectRevision({ schemaVersion: 1, id: 'revision-1', projectId: 'project-1', source: 'directory', capturedAt: '2026-10-13T00:00:00.000Z', label: 'import' })).toMatchObject({ id: 'revision-1', source: 'directory' });
    expect(parseProjectRevision({ schemaVersion: 1, id: '../bad', projectId: 'project-1' })).toBeNull();
  });

  it('keeps artifact identity while stripping local paths', () => {
    const value = parseBuildArtifact({ schemaVersion: 1, id: 'artifact-1', projectRevisionId: 'revision-1', buildId: 'build-1', kind: 'elf', fileName: 'C:\\private\\app.elf', byteLength: 42, sha256: digest, capturedAt: '2026-10-13T00:00:00.000Z', toolchain: { name: 'IAR', version: '9' } });
    expect(value).toMatchObject({ fileName: 'app.elf', sha256: digest, toolchain: { name: 'IAR', version: '9' } });
    expect(parseBuildArtifact({ ...value, sha256: 'not-a-hash' })).toBeNull();
  });

  it('requires firmware to reference an exact build artifact', () => {
    expect(parseFirmwareIdentity({ schemaVersion: 1, id: 'firmware-1', buildArtifactId: 'artifact-1', sha256: digest, byteLength: 42, format: 'bin', capturedAt: '2026-10-13T00:00:00.000Z' })).toMatchObject({ buildArtifactId: 'artifact-1' });
    expect(parseFirmwareIdentity({ schemaVersion: 1, id: 'firmware-1', sha256: digest })).toBeNull();
  });

  it('validates session chronology and drops legacy project/device relationships', () => {
    const value = { schemaVersion: 1, id: 'session-1', sourceSessionId: 'agent-session-1', transport: 'serial', status: 'failed', startedAt: '2026-10-13T00:00:00.000Z', endedAt: '2026-10-13T00:01:00.000Z', endpoint: 'COM3 @ 115200', rxBytes: 10, txBytes: 5, projectId: 'project-1', deviceId: 'device-1', firmwareId: 'firmware-1', evidenceIds: ['event-1', 'event-1', '../bad'] };
    expect(parseCommunicationSession(value)).toEqual(expect.not.objectContaining({ projectId: expect.anything(), deviceId: expect.anything() }));
    expect(parseCommunicationSession(value)).toMatchObject({ sourceSessionId: 'agent-session-1', firmwareId: 'firmware-1', evidenceIds: ['event-1'] });
    expect(parseCommunicationSession({ ...value, endedAt: '2026-10-12T23:59:00.000Z' })).toBeNull();
    expect(parseCommunicationSession({ ...value, status: 'active', endedAt: undefined })).toMatchObject({ status: 'active' });
    expect(parseCommunicationSession({ ...value, status: 'completed', endedAt: undefined })).toBeNull();
  });

  it('deduplicates records and drops unknown schema versions', () => {
    const first = { schemaVersion: 1, id: 'revision-1', projectId: 'project-1', source: 'manual', capturedAt: '2026-10-13T00:00:00.000Z', label: 'manual baseline' };
    expect(normalizeLifecycleRecords([first, first, { ...first, schemaVersion: 2 }], parseProjectRevision)).toHaveLength(1);
  });
});
