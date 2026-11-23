const installJobPath = /^\/api\/environment\/install-jobs\/([0-9a-f-]+)$/i;

export function registerEnvironmentRoutes(router, dependencies) {
  const {
    jsonResponse,
    detectInstallations,
    listInstallManifests,
    startInstallJob,
    getInstallJob,
    publicInstallJob,
    cancelInstallJob,
  } = dependencies;

  router.register({
    id: 'environment.installations',
    method: 'GET',
    path: '/api/environment/installations',
    handler: async ({ res }) => {
      try { jsonResponse(res, 200, await detectInstallations()); }
      catch (error) { jsonResponse(res, 500, { error: error.message }); }
    },
  });
  router.register({
    id: 'environment.install-manifests',
    method: 'GET',
    path: '/api/environment/install-manifests',
    handler: async ({ res }) => {
      try { jsonResponse(res, 200, listInstallManifests()); }
      catch (error) { jsonResponse(res, 500, { error: error.message }); }
    },
  });
  router.register({
    id: 'environment.install-jobs',
    method: 'POST',
    path: '/api/environment/install-jobs',
    handler: async ({ req, res }) => {
      try { jsonResponse(res, 202, await startInstallJob(req)); }
      catch (error) { jsonResponse(res, 400, { error: error.message }); }
    },
  });
  router.register({
    id: 'environment.install-job',
    method: 'GET',
    path: installJobPath,
    handler: async ({ res, match }) => {
      const job = getInstallJob(match[1]);
      if (!job) { jsonResponse(res, 404, { error: 'Installation job not found' }); return; }
      jsonResponse(res, 200, publicInstallJob(job));
    },
  });
  router.register({
    id: 'environment.install-job-cancel',
    method: 'DELETE',
    path: installJobPath,
    handler: async ({ res, match }) => {
      const job = getInstallJob(match[1]);
      if (!job) { jsonResponse(res, 404, { error: 'Installation job not found' }); return; }
      if (job.state !== 'running') { jsonResponse(res, 409, { error: 'Installation job is not running' }); return; }
      cancelInstallJob(job);
      jsonResponse(res, 202, publicInstallJob(job));
    },
  });
  router.register({
    id: 'environment.install-job-unsupported',
    method: 'POST',
    path: installJobPath,
    handler: async ({ res, match }) => {
      const job = getInstallJob(match[1]);
      if (!job) { jsonResponse(res, 404, { error: 'Installation job not found' }); return; }
      jsonResponse(res, 405, { error: 'Unsupported operation for installation job' });
    },
  });
  return router;
}
