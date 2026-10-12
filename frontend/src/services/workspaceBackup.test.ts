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
    projects: [{ id: 'project-1', name: '控制器', productModel: '', chipModel: '', description: '', tags: [], devices: [], createdAt: '', updatedAt: '2026-10-12T00:00:00.000Z' }],
    runs: [{ id: 'run-1', projectId: '', deviceId: '', suiteId: '', suiteName: '', caseId: '', caseName: '验收', status: 'passed', startedAt: '2026-10-12T00:00:00.000Z', finishedAt: '', durationMs: 1, passed: 1, failed: 0, agentVersion: '1', environment: {}, steps: [], logs: [] }],
    settings: [],
  },
  privacy: { excluded: [], note: '' },
});

describe('workspace backup', () => {
  it('validates the schema and strips secret variables and unknown local keys', () => {
    const value = backup() as WorkspaceBackup & { local: Record<string, unknown> };
    value.local['embedkit-ai-config'] = { apiKey: 'should-not-import' };
    const parsed = parseWorkspaceBackup(JSON.stringify(value));

    expect(JSON.stringify(parsed)).not.toContain('secret-value');
    expect(parsed.local).not.toHaveProperty('embedkit-ai-config');
    expect(parsed.local['embedkit.automation.suites']).toEqual([{ id: 'suite-1', variables: [{ name: 'PASSWORD', value: '', secret: true }] }]);
  });

  it('previews stable-id conflicts without changing existing data', () => {
    localStorage.setItem('embedkit.tool-preferences', '{}');
    const value = backup();
    const preview = previewWorkspaceBackup(value, { projects: value.product.projects, runs: value.product.runs, settings: [] });

    expect(preview).toMatchObject({ projects: 1, projectConflicts: 1, runs: 1, runConflicts: 1, localSettings: 2, localConflicts: 1 });
  });

  it('rejects incompatible, oversized, and structurally invalid backups', () => {
    expect(() => parseWorkspaceBackup('{}')).toThrow(/格式或版本/);
    expect(() => parseWorkspaceBackup('x'.repeat(WORKSPACE_BACKUP_MAX_BYTES + 1))).toThrow(/16 MiB/);
    const value = backup();
    value.product.projects = [{} as never];
    expect(() => parseWorkspaceBackup(JSON.stringify(value))).toThrow(/设备项目数据/);
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

  it('rolls back local settings when the database merge fails', async () => {
    localStorage.setItem('embedkit.tool-preferences', 'old');
    await expect(applyWorkspaceBackup(backup(), localStorage, async () => { throw new Error('database failed'); })).rejects.toThrow('database failed');
    expect(localStorage.getItem('embedkit.tool-preferences')).toBe('old');
    expect(localStorage.getItem('embedkit.automation.suites')).toBeNull();
  });
});
