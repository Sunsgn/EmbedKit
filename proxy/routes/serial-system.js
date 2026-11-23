const administratorError = /access.*denied|elevation|administrator|exit(?:ed)? with code 5/i;

export function registerSerialSystemRoutes(router, dependencies) {
  const { jsonResponse, readJsonBody, status, listPorts, scanDrivers, installDriver } = dependencies;

  router.register({
    id: 'serial.status',
    method: 'GET',
    path: '/api/serial/status',
    handler: async ({ res }) => jsonResponse(res, 200, status()),
  });
  router.register({
    id: 'serial.ports',
    method: 'GET',
    path: '/api/serial/ports',
    handler: async ({ res }) => {
      try { jsonResponse(res, 200, { ports: await listPorts() }); }
      catch (error) { jsonResponse(res, 500, { error: error.message }); }
    },
  });
  router.register({
    id: 'serial.drivers',
    method: 'GET',
    path: '/api/serial/drivers',
    handler: async ({ res }) => {
      try { jsonResponse(res, 200, await scanDrivers()); }
      catch (error) { jsonResponse(res, 500, { code: 'serial-driver-scan-failed', error: error.message }); }
    },
  });
  router.register({
    id: 'serial.driver-install',
    method: 'POST',
    path: '/api/serial/drivers/install',
    handler: async ({ req, res }) => {
      try { jsonResponse(res, 200, await installDriver(await readJsonBody(req))); }
      catch (error) {
        const permission = administratorError.test(error.message);
        jsonResponse(res, permission ? 403 : 400, {
          code: permission ? 'administrator-required' : 'serial-driver-install-failed',
          error: permission ? '驱动安装需要管理员权限，请以管理员身份重新启动 Local Agent 后重试' : error.message,
        });
      }
    },
  });
  return router;
}
