import { afterEach, describe, expect, it, vi } from 'vitest';
import { authorizeBuildArtifact, createBuildJob, detectBuildEnvironment, hashBuildArtifact, readBuildJob, stopBuildJob } from './buildAgent';

afterEach(() => vi.unstubAllGlobals());
const response = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'X-EmbedKit-Protocol': '1' } });

describe('project build Local Agent service', () => {
  it('uses centralized requests for detection and the complete job lifecycle', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(response({ events: [] })));
    vi.stubGlobal('fetch', fetch);

    await detectBuildEnvironment('D:\\firmware\\demo');
    await createBuildJob({ rootPath: 'D:\\firmware\\demo', system: 'cmake', buildDir: 'build', configuration: 'Debug', toolPath: 'cmake', action: 'build' });
    await readBuildJob('build-1', 8);
    await stopBuildJob('build-1');
    await authorizeBuildArtifact('build-1', 2);
    await hashBuildArtifact('build-1', 2);

    expect(fetch.mock.calls.map(call => new URL(String(call[0])).pathname + new URL(String(call[0])).search)).toEqual([
      '/api/build/detect',
      '/api/build/jobs',
      '/api/build/jobs/build-1?after=8',
      '/api/build/jobs/build-1',
      '/api/build/jobs/build-1/artifacts/2/select',
      '/api/build/jobs/build-1/artifacts/2/hash',
    ]);
    expect(fetch.mock.calls[0][1]).toEqual(expect.objectContaining({ method: 'POST', body: JSON.stringify({ rootPath: 'D:\\firmware\\demo' }) }));
    expect(fetch.mock.calls[3][1]).toEqual(expect.objectContaining({ method: 'DELETE' }));
    expect(fetch.mock.calls[4][1]).toEqual(expect.objectContaining({ method: 'POST' }));
    expect(fetch.mock.calls[5][1]).toEqual(expect.objectContaining({ method: 'POST' }));
  });
});
