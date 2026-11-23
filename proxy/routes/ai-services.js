const proxyPath = /^\/proxy\/(.+)$/;

const registerCompatibilityMethods = (router, baseId, path, handler) => {
  for (const [suffix, method] of [['post-compatibility', 'POST'], ['delete-compatibility', 'DELETE']]) {
    router.register({ id: `ai.${baseId}-${suffix}`, method, path, handler });
  }
};

export function registerAiServiceRoutes(router, dependencies) {
  const { jsonResponse, detectServers, proxyRequest } = dependencies;
  const listServers = async ({ res }) => jsonResponse(res, 200, { servers: await detectServers() });
  const listModels = async ({ res, requestUrl }) => {
    const serverName = requestUrl.searchParams.get('server'), servers = await detectServers();
    const matched = servers.find(server => server.name.toLowerCase() === serverName?.toLowerCase());
    if (!matched) { jsonResponse(res, 404, { error: `Server "${serverName}" not found` }); return; }
    jsonResponse(res, 200, { models: matched.models, server: matched.name });
  };

  router.register({ id: 'ai.servers', method: 'GET', path: '/api/servers', handler: listServers });
  registerCompatibilityMethods(router, 'servers', '/api/servers', listServers);
  router.register({ id: 'ai.models', method: 'GET', path: '/api/models', handler: listModels });
  registerCompatibilityMethods(router, 'models', '/api/models', listModels);
  for (const [id, method] of [['ai.proxy-get', 'GET'], ['ai.proxy-post', 'POST'], ['ai.proxy-delete', 'DELETE']]) {
    router.register({ id, method, path: proxyPath, handler: async ({ req, res, match }) => proxyRequest(req, res, match[1]) });
  }
  return router;
}
