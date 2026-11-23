const buildJobPath = /^\/api\/build\/jobs\/([0-9a-f-]+)$/i;

export function registerBuildRoutes(router, dependencies) {
  const {
    jsonResponse,
    readJsonBody,
    detectEnvironment,
    listJobs,
    startJob,
    getJob,
    publicJob,
    stopJob,
  } = dependencies;

  router.register({
    id: 'build.detect',
    method: 'POST',
    path: '/api/build/detect',
    handler: async ({ req, res }) => {
      try {
        const body = await readJsonBody(req);
        jsonResponse(res, 200, await detectEnvironment(body.rootPath));
      } catch (error) { jsonResponse(res, 400, { error: error.message }); }
    },
  });
  router.register({
    id: 'build.jobs-list',
    method: 'GET',
    path: '/api/build/jobs',
    handler: async ({ res }) => jsonResponse(res, 200, { jobs: listJobs().map(job => publicJob(job)) }),
  });
  router.register({
    id: 'build.jobs',
    method: 'POST',
    path: '/api/build/jobs',
    handler: async ({ req, res }) => {
      try { jsonResponse(res, 201, publicJob(await startJob(await readJsonBody(req)))); }
      catch (error) { jsonResponse(res, 400, { error: error.message }); }
    },
  });
  router.register({
    id: 'build.job',
    method: 'GET',
    path: buildJobPath,
    handler: async ({ res, match, requestUrl }) => {
      const job = getJob(match[1]);
      if (!job) { jsonResponse(res, 404, { error: 'Build job not found' }); return; }
      const after = Math.max(0, Number(requestUrl.searchParams.get('after') || 0));
      jsonResponse(res, 200, publicJob(job, Number.isFinite(after) ? after : 0));
    },
  });
  router.register({
    id: 'build.job-cancel',
    method: 'DELETE',
    path: buildJobPath,
    handler: async ({ res, match }) => {
      const job = getJob(match[1]);
      if (!job) { jsonResponse(res, 404, { error: 'Build job not found' }); return; }
      stopJob(job);
      jsonResponse(res, 200, publicJob(job));
    },
  });
  router.register({
    id: 'build.job-unsupported',
    method: 'POST',
    path: buildJobPath,
    handler: async ({ res, match }) => {
      const job = getJob(match[1]);
      if (!job) { jsonResponse(res, 404, { error: 'Build job not found' }); return; }
      jsonResponse(res, 405, { error: 'Unsupported operation for build job' });
    },
  });
  return router;
}
