export function registerFileAnalysisRoutes(router, dependencies) {
  const { jsonResponse, selectPath, scanProject, revokeSelection, getSelection, readChunk, analyzeElf, lookupElf, disassembleElf } = dependencies;
  router.register({ id: 'files.select', method: 'POST', path: '/api/files/select', handler: async ({ req, res }) => { try { jsonResponse(res, 200, await selectPath(req)); } catch (error) { jsonResponse(res, 400, { error: error.message }); } } });
  router.register({ id: 'projects.scan', method: 'POST', path: '/api/projects/scan', handler: async ({ req, res }) => { try { jsonResponse(res, 200, await scanProject(req)); } catch (error) { jsonResponse(res, 400, { error: error.message }); } } });
  router.register({
    id: 'files.chunk', method: 'GET', path: /^\/api\/files\/selections\/([0-9a-f-]+)\/chunk$/i,
    handler: async ({ res, requestUrl, match }) => { try { jsonResponse(res, 200, await readChunk(match[1], requestUrl.searchParams.get('offset'), requestUrl.searchParams.get('length'))); } catch (error) { jsonResponse(res, 400, { error: error.message }); } },
  });
  router.register({
    id: 'files.selection', method: 'GET', path: /^\/api\/files\/selections\/([0-9a-f-]+)$/i,
    handler: async ({ res, match }) => { try { const selection = getSelection(match[1]), { path: _path, expiresAt, ...safe } = selection; jsonResponse(res, 200, { ...safe, expiresAt: new Date(expiresAt).toISOString() }); } catch (error) { jsonResponse(res, 400, { error: error.message }); } },
  });
  router.register({ id: 'files.revoke', method: 'DELETE', path: /^\/api\/files\/selections\/([0-9a-f-]+)$/i, handler: async ({ res, match }) => jsonResponse(res, 200, { revoked: revokeSelection(match[1]) }) });
  router.register({ id: 'elf.analyze', method: 'GET', path: /^\/api\/elf\/analyze\/([0-9a-f-]+)$/i, handler: async ({ res, match }) => { try { jsonResponse(res, 200, await analyzeElf(match[1])); } catch (error) { jsonResponse(res, 400, { error: error.message }); } } });
  router.register({ id: 'elf.lookup', method: 'GET', path: /^\/api\/elf\/analyses\/([0-9a-f-]+)\/lookup$/i, handler: async ({ res, requestUrl, match }) => { try { jsonResponse(res, 200, lookupElf(match[1], requestUrl.searchParams.get('address'))); } catch (error) { jsonResponse(res, 400, { error: error.message }); } } });
  router.register({ id: 'elf.disassemble', method: 'GET', path: /^\/api\/elf\/analyses\/([0-9a-f-]+)\/disassemble$/i, handler: async ({ res, requestUrl, match }) => { try { jsonResponse(res, 200, await disassembleElf(match[1], requestUrl.searchParams.get('address'), requestUrl.searchParams.get('before'), requestUrl.searchParams.get('after'))); } catch (error) { jsonResponse(res, 400, { error: error.message }); } } });
  return router;
}
