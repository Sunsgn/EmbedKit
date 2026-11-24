import { describe, expect, it } from 'vitest';
import type { TestRunRecord } from '../../types/product';
import { createPortableTestRunJsonReport, createTestRunCsvReport, createTestRunHtmlReport, createTestRunJunitReport } from './testRunReports';

const run: TestRunRecord = {
  schemaVersion: 3,
  id: 'run-1', suiteId: 'suite-1', suiteName: 'Suite <unsafe>', caseId: 'case-1', caseName: 'AT & network',
  status: 'failed', startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:00:01.000Z', durationMs: 1000,
  passed: 0, failed: 1, agentVersion: '1.0.0', environment: { mode: 'test & verify' },
  communications: [{ channel: 'serial-a', transport: 'serial', sessionId: 'session-1', endpoint: 'COM1', rxBytes: 3, txBytes: 2 }],
  communicationSessionIds: ['archive-1'],
  steps: [{ id: 'step-1', name: 'Send "AT"', type: 'command', channel: 'serial-a', status: 'failed', startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:00:01.000Z', durationMs: 1000, retries: 1, error: '<timeout>', evidence: { source: 'device-response', expected: 'OK', observed: 'ERROR' } }],
  logs: [{ time: '00:00:00.000', level: 'fail', text: '<script>alert(1)</script>' }],
};

describe('test run report serializers', () => {
  it('creates escaped traceable HTML without executable markup', () => {
    const html = createTestRunHtmlReport(run);
    expect(html).toContain('Suite &lt;unsafe&gt;');
    expect(html).toContain('归档 archive-1');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('creates valid escaped JUnit evidence', () => {
    const xml = createTestRunJunitReport(run);
    expect(xml).toContain('failures="1"');
    expect(xml).toContain('&lt;timeout&gt;');
    expect(xml).toContain('Suite &lt;unsafe&gt;');
  });

  it('creates portable CSV and JSON outputs', () => {
    expect(createTestRunCsvReport(run)).toContain('"Send ""AT"""');
    const json = JSON.parse(createPortableTestRunJsonReport(run));
    expect(json.run.id).toBe('run-1');
    expect(json.run.communications[0].sessionId).toBe('session-1');
  });
});
