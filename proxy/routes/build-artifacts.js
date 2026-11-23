const artifactPath = action => new RegExp(`^/api/build/jobs/([0-9a-f-]+)/artifacts/(\\d+)/${action}$`, 'i');
const selectPath = artifactPath('select');
const hashPath = artifactPath('hash');

const findJob = (getJob, jsonResponse, res, id) => {
  const job = getJob(id);
  if (!job) jsonResponse(res, 404, { error: 'Build job not found' });
  return job;
};

const registerUnsupportedMethods = (router, { ids, path, message, jsonResponse }) => {
  for (const [id, method] of [[ids.read, 'GET'], [ids.delete, 'DELETE']]) {
    router.register({
      id,
      method,
      path,
      handler: async ({ res }) => jsonResponse(res, 405, { error: message }),
    });
  }
};

export function registerBuildArtifactRoutes(router, dependencies) {
  const { jsonResponse, getJob, authorizeArtifact, hashArtifact } = dependencies;

  router.register({
    id: 'build.artifact-select',
    method: 'POST',
    path: selectPath,
    handler: async ({ res, match }) => {
      const job = findJob(getJob, jsonResponse, res, match[1]);
      if (!job) return;
      try { jsonResponse(res, 200, await authorizeArtifact(job, match[2])); }
      catch (error) { jsonResponse(res, 400, { error: error.message }); }
    },
  });
  registerUnsupportedMethods(router, {
    ids: { read: 'build.artifact-select-read-unsupported', delete: 'build.artifact-select-delete-unsupported' },
    path: selectPath,
    message: 'Build artifact authorization requires POST',
    jsonResponse,
  });

  router.register({
    id: 'build.artifact-hash',
    method: 'POST',
    path: hashPath,
    handler: async ({ res, match }) => {
      const job = findJob(getJob, jsonResponse, res, match[1]);
      if (!job) return;
      try { jsonResponse(res, 200, await hashArtifact(job, match[2])); }
      catch (error) { jsonResponse(res, 400, { error: error.message }); }
    },
  });
  registerUnsupportedMethods(router, {
    ids: { read: 'build.artifact-hash-read-unsupported', delete: 'build.artifact-hash-delete-unsupported' },
    path: hashPath,
    message: 'Build artifact hashing requires POST',
    jsonResponse,
  });
  return router;
}
