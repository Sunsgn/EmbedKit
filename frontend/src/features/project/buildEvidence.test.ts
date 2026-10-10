import { describe, expect, it } from 'vitest';
import { createBuildEvidence } from './buildEvidence';

describe('build evidence manifest', () => {
  it('preserves verifiable build facts without exporting local absolute paths or raw logs', () => {
    const manifest = createBuildEvidence({
      id: 'job-1', state: 'failed', exitCode: 2, startedAt: '2026-10-10T00:00:00.000Z', finishedAt: '2026-10-10T00:00:01.250Z', system: 'cmake', action: 'build', configuration: 'Release', executable: 'C:\\tools\\cmake.exe', rootPath: 'D:\\secret\\device', buildPath: 'D:\\secret\\device\\build',
      artifacts: [{ name: 'app.elf', path: 'D:\\secret\\device\\build\\app.elf', type: 'elf', size: 4096, modifiedAt: '2026-10-10T00:00:01.000Z' }],
      events: [{ id: 1, timestamp: '', stream: 'stderr', text: 'D:\\secret\\device\\src\\main.c:7: error', diagnostic: { file: 'D:\\secret\\device\\src\\main.c', line: 7, column: 3, severity: 'error', message: 'unknown symbol' } }],
    }, { projectPath: 'D:\\secret\\device', system: 'cmake', action: 'build', configuration: 'Release', toolPath: 'C:\\tools\\cmake.exe' }, '2026-10-10T00:00:02.000Z', { 0: 'abc123' });
    expect(manifest.build).toMatchObject({ projectName: 'device', tool: 'cmake.exe', durationMs: 1250 });
    expect(manifest.summary).toEqual({ artifacts: 1, errors: 1, warnings: 0, notes: 0 });
    expect(manifest.artifacts[0]).toEqual({ name: 'app.elf', type: 'elf', size: 4096, modifiedAt: '2026-10-10T00:00:01.000Z', sha256: 'abc123' });
    expect(manifest.diagnostics[0].file).toBe('main.c');
    expect(JSON.stringify(manifest)).not.toContain('D:\\\\secret');
    expect(JSON.stringify(manifest)).not.toContain('text');
  });
});
