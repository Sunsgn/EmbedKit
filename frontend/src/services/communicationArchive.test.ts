import { describe, expect, it } from 'vitest';
import { createCommunicationSessionRecords, type ArchivedCommunicationEvidence } from './communicationArchive';

const evidence: ArchivedCommunicationEvidence = { channel: 'tcp', transport: 'tcp', sessionId: 'network-1', endpoint: 'client:127.0.0.1:9000', rxBytes: 4, txBytes: 5, startedAt: '2026-10-14T00:00:00.000Z' };

describe('communication session archive', () => {
  it('creates a stable run-scoped session with optional device and firmware links', () => {
    expect(createCommunicationSessionRecords([evidence], { runId: 'run-1', finishedAt: '2026-10-14T00:01:00.000Z', status: 'passed', firmwareId: 'firmware-1' })).toEqual([
      expect.objectContaining({ id: 'run-1:tcp', sourceSessionId: 'network-1', status: 'completed', firmwareId: 'firmware-1', rxBytes: 4, txBytes: 5 }),
    ]);
  });

  it('preserves failed and aborted outcomes instead of calling them completed', () => {
    expect(createCommunicationSessionRecords([evidence], { runId: 'run-failed', finishedAt: '2026-10-14T00:01:00.000Z', status: 'failed' })[0].status).toBe('failed');
    expect(createCommunicationSessionRecords([evidence], { runId: 'run-aborted', finishedAt: '2026-10-14T00:01:00.000Z', status: 'aborted' })[0].status).toBe('aborted');
  });

  it('rejects impossible chronology instead of persisting misleading evidence', () => {
    expect(() => createCommunicationSessionRecords([evidence], { runId: 'run-1', finishedAt: '2026-10-13T23:59:00.000Z', status: 'passed' })).toThrow(/无法归档/);
  });
});
