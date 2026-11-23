import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentRouter } from '../server/router.js';
import { registerBuildArtifactRoutes } from './build-artifacts.js';

const jobId = '11111111-1111-1111-1111-111111111111';
const dispatch = async (router, method, pathname) => {
  const res = {};
  const handled = await router.dispatch({ req: { method }, res, pathname, requestUrl: new URL(`http://localhost${pathname}`) });
  return { handled, ...res };
};

const createRouter = overrides => registerBuildArtifactRoutes(new AgentRouter(), {
  jsonResponse: (res, status, value) => { res.status = status; res.value = value; },
  getJob: id => id === jobId ? { id } : undefined,
  authorizeArtifact: async (job, index) => ({ selectionId: `${job.id}:${index}` }),
  hashArtifact: async (_job, index) => ({ algorithm: 'sha256', digest: `digest-${index}` }),
  ...overrides,
});

test('build artifact routes authorize and hash through injected bounded operations', async () => {
  const router = createRouter();
  const selected = await dispatch(router, 'POST', `/api/build/jobs/${jobId}/artifacts/2/select`);
  assert.equal(selected.handled, true);
  assert.equal(selected.status, 200);
  assert.equal(selected.value.selectionId, `${jobId}:2`);
  const hashed = await dispatch(router, 'POST', `/api/build/jobs/${jobId}/artifacts/3/hash`);
  assert.equal(hashed.status, 200);
  assert.deepEqual(hashed.value, { algorithm: 'sha256', digest: 'digest-3' });
});

test('build artifact routes preserve missing job, method, and operation failures', async () => {
  const router = createRouter({ authorizeArtifact: async () => { throw new Error('artifact changed'); } });
  assert.equal((await dispatch(router, 'POST', '/api/build/jobs/00000000-0000-0000-0000-000000000000/artifacts/0/select')).status, 404);
  const wrongMethod = await dispatch(router, 'GET', `/api/build/jobs/${jobId}/artifacts/0/select`);
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.value.error, 'Build artifact authorization requires POST');
  const failed = await dispatch(router, 'POST', `/api/build/jobs/${jobId}/artifacts/0/select`);
  assert.equal(failed.status, 400);
  assert.equal(failed.value.error, 'artifact changed');
});
