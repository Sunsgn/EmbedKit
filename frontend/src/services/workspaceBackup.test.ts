import { describe, expect, it } from 'vitest';
import type { WorkspaceBackup } from './workspaceBackup';
import { applyWorkspaceBackup, parseWorkspaceBackup, previewWorkspaceBackup, WORKSPACE_BACKUP_MAX_BYTES } from './workspaceBackup';
import { createPortableProductData } from './productStorage';

const backup = (): WorkspaceBackup => ({
  schema: 'embedkit.workspace-backup',
  version: 1,
  createdAt: '2026-10-12T00:00:00.000Z',
  local: {
    'embedkit.automation.suites': [{ id: 'suite-1', variables: [{ name: 'PASSWORD', value: 'secret-value', secret: true }] }],
    'embedkit.tool-preferences': { version: 1, favorites: ['crc'] },
  },
  product: {
    projects: [{ schemaVersion: 3, id: 'project-1', name: '控制器', productModel: '', chipModel: '', description: '', tags: [], createdAt: '', updatedAt: '2026-10-12T00:00:00.000Z' }],
    runs: [{ schemaVersion: 3, id: 'run-1', suiteId: '', suiteName: '', caseId: '', caseName: '验收', status: 'passed', startedAt: '2026-10-12T00:00:00.000Z', finishedAt: '', durationMs: 1, passed: 1, failed: 0, agentVersion: '1', environment: {}, steps: [], logs: [] }],
  },
  privacy: { excluded: [], note: '' },
});

describe('workspace backup', () => {
  it('validates the schema and strips secret variables and unknown local keys', () => {
    const value = backup() as WorkspaceBackup & { local: Record<string, unknown> };
    value.local['embedkit-ai-config'] = { apiKey: 'should-not-import' };
    value.local['embedkit.project-local-bindings'] = [{ projectId: 'project-1', path: 'D:\\private-source' }];
    const parsed = parseWorkspaceBackup(JSON.stringify(value));

    expect(JSON.stringify(parsed)).not.toContain('secret-value');
    expect(parsed.local).not.toHaveProperty('embedkit-ai-config');
    expect(parsed.local).not.toHaveProperty('embedkit.project-local-bindings');
    expect(parsed.local['embedkit.automation.suites']).toEqual([{ id: 'suite-1', variables: [{ name: 'PASSWORD', value: '', secret: true }] }]);
  });

  it('previews stable-id conflicts without changing existing data', () => {
    localStorage.setItem('embedkit.tool-preferences', '{}');
    const value = backup();
    value.product.projectRevisions = [{ schemaVersion: 1, id: 'revision-1', projectId: 'project-1', source: 'manual', capturedAt: '2026-10-13T00:00:00.000Z', label: 'baseline' }];
    const preview = previewWorkspaceBackup(value, { projects: value.product.projects, runs: value.product.runs, projectRevisions: value.product.projectRevisions });

    expect(preview).toMatchObject({ projects: 1, projectConflicts: 1, runs: 1, runConflicts: 1, lifecycleRecords: 1, lifecycleConflicts: 1, localSettings: 2, localConflicts: 1 });
  });

  it('accepts selection records as portable local data', async () => {
    const value = backup() as WorkspaceBackup & { local: Record<string, unknown> };
    value.local['embedkit.part-selection-records'] = [];
    const parsed = parseWorkspaceBackup(JSON.stringify(value));
    expect(parsed.local['embedkit.part-selection-records']).toEqual([]);
    await applyWorkspaceBackup(parsed, localStorage, async () => undefined);
    expect(localStorage.getItem('embedkit.part-selection-records')).toBe('[]');
  });

  it('rejects incompatible, oversized, and structurally invalid backups', () => {
    expect(() => parseWorkspaceBackup('{}')).toThrow(/格式或版本/);
    expect(() => parseWorkspaceBackup('x'.repeat(WORKSPACE_BACKUP_MAX_BYTES + 1))).toThrow(/16 MiB/);
    const value = backup();
    value.product.projects = [{} as never];
    expect(() => parseWorkspaceBackup(JSON.stringify(value))).toThrow(/工程档案数据/);
  });

  it('removes raw test evidence from portable history summaries', () => {
    const value = backup();
    value.product.runs[0].environment = { PASSWORD: 'secret', DEVICE_IP: '192.0.2.1' };
    value.product.runs[0].logs = [{ time: '1', level: 'rx', text: 'private response' }];
    value.product.runs[0].steps = [{ id: 's', name: 'step', type: 'match', channel: 'serial-a', status: 'failed', startedAt: '', finishedAt: '', durationMs: 1, retries: 0, error: 'private failure', evidence: { source: 'device-response', observed: 'private response', expected: 'OK', timeoutMs: 1000 } }];
    const portable = createPortableProductData(value.product);

    expect(portable.runs[0].environment).toEqual({ DEVICE_IP: '192.0.2.1' });
    expect(portable.runs[0].logs).toEqual([]);
    expect(portable.runs[0].steps[0]).not.toHaveProperty('error');
    expect(portable.runs[0].steps[0].evidence).toEqual({ source: 'device-response', timeoutMs: 1000 });
  });

  it('imports versioned lifecycle links while old backups remain compatible', () => {
    const legacy = parseWorkspaceBackup(JSON.stringify(backup()));
    expect(legacy.product.projectRevisions).toEqual([]);

    const value = backup();
    value.product.projectRevisions = [{ schemaVersion: 1, id: 'revision-1', projectId: 'project-1', source: 'git', capturedAt: '2026-10-13T00:00:00.000Z', label: 'main', revision: 'abc123' }];
    value.product.buildArtifacts = [{ schemaVersion: 1, id: 'artifact-1', projectRevisionId: 'revision-1', buildId: 'build-1', kind: 'bin', fileName: 'firmware.bin', byteLength: 8, sha256: 'ab'.repeat(32), capturedAt: '2026-10-13T00:01:00.000Z' }];
    value.product.firmwareIdentities = [{ schemaVersion: 1, id: 'firmware-1', buildArtifactId: 'artifact-1', sha256: 'ab'.repeat(32), byteLength: 8, format: 'bin', capturedAt: '2026-10-13T00:01:00.000Z' }];
    value.product.communicationSessions = [{ schemaVersion: 1, id: 'session-1', transport: 'serial', status: 'completed', startedAt: '2026-10-13T00:02:00.000Z', endedAt: '2026-10-13T00:03:00.000Z', endpoint: 'COM3', rxBytes: 8, txBytes: 4, firmwareId: 'firmware-1', evidenceIds: [] }];
    const parsed = parseWorkspaceBackup(JSON.stringify(value));

    expect(parsed.product.projectRevisions?.[0].id).toBe('revision-1');
    expect(parsed.product.communicationSessions?.[0]).toMatchObject({ firmwareId: 'firmware-1' });
    expect(parsed.product.communicationSessions?.[0]).not.toHaveProperty('deviceId');
  });

  it('does not include an active hardware session in a portable backup', () => {
    const value = backup().product;
    value.communicationSessions = [
      { schemaVersion: 1, id: 'session-active', transport: 'serial', status: 'active', startedAt: '2026-10-13T00:00:00.000Z', endpoint: 'COM3', rxBytes: 0, txBytes: 0, evidenceIds: [] },
      { schemaVersion: 1, id: 'session-done', transport: 'serial', status: 'completed', startedAt: '2026-10-13T00:00:00.000Z', endedAt: '2026-10-13T00:01:00.000Z', endpoint: 'COM3', rxBytes: 1, txBytes: 1, evidenceIds: [] },
    ];

    expect(createPortableProductData(value).communicationSessions?.map(item => item.id)).toEqual(['session-done']);
  });

  it('rejects malformed lifecycle collections instead of silently losing records', () => {
    const value = backup();
    value.product.projectRevisions = [{ schemaVersion: 2 } as never];
    expect(() => parseWorkspaceBackup(JSON.stringify(value))).toThrow(/工程修订数据无效/);

    const wrongShape = backup() as unknown as { product: Record<string, unknown> };
    wrongShape.product.projectRevisions = {};
    expect(() => parseWorkspaceBackup(JSON.stringify(wrongShape))).toThrow(/工程修订数据无效/);
  });

  it('rolls back local settings when the database merge fails', async () => {
    localStorage.setItem('embedkit.tool-preferences', 'old');
    await expect(applyWorkspaceBackup(backup(), localStorage, async () => { throw new Error('database failed'); })).rejects.toThrow('database failed');
    expect(localStorage.getItem('embedkit.tool-preferences')).toBe('old');
    expect(localStorage.getItem('embedkit.automation.suites')).toBeNull();
  });
});
