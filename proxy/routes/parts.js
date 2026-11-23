export function registerPartRoutes(router, dependencies) {
  const { jsonResponse, discoverDocuments, readDocument, readPartDetails, maxDocumentResults } = dependencies;
  router.register({
    id: 'parts.sources', method: 'GET', path: '/api/parts/sources',
    handler: async ({ res }) => jsonResponse(res, 200, { schemaVersion: 1, sources: [
      { id: 'snapmagic', name: 'SnapMagic', kind: 'aggregator', state: 'configured', capabilities: ['keyword-details', 'datasheet-link'], dataScope: '仅发送用户输入的器件型号', authoritative: false },
      { id: 'manufacturer-navigation', name: '厂商官方资料导航', kind: 'manufacturer', state: 'configured', capabilities: ['product-page-link', 'official-pdf-discovery'], dataScope: '仅向已注册的厂商官方域名发送器件型号并限量读取产品页面', authoritative: true },
    ], limits: { queryLength: 120, automaticPdfDownload: false, parametricSearch: false, documentResults: maxDocumentResults } }),
  });
  router.register({
    id: 'parts.documents', method: 'GET', path: '/api/parts/documents',
    handler: async ({ res, requestUrl }) => {
      try { jsonResponse(res, 200, await discoverDocuments({ model: requestUrl.searchParams.get('part'), manufacturer: requestUrl.searchParams.get('manufacturer'), productUrl: requestUrl.searchParams.get('productUrl') })); }
      catch (error) { jsonResponse(res, 400, { error: error.message, code: 'invalid-document-query' }); }
    },
  });
  router.register({
    id: 'parts.document-content', method: 'GET', path: '/api/parts/document-content',
    handler: async ({ res, requestUrl }) => {
      try {
        const result = await readDocument(requestUrl.searchParams.get('url'));
        const candidate = new URL(result.finalUrl).pathname.split('/').filter(Boolean).pop() || 'official-document.pdf';
        const fileName = /\.pdf$/i.test(candidate) ? candidate : `${candidate}.pdf`;
        res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': result.bytes.length, 'Content-Disposition': `inline; filename="${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}"`, 'X-EmbedKit-Source-Url': result.finalUrl });
        res.end(result.bytes);
      } catch (error) { jsonResponse(res, /registered manufacturer domain/.test(error.message) ? 403 : 502, { error: error.message, code: 'official-pdf-unavailable' }); }
    },
  });
  router.register({
    id: 'parts.details', method: 'GET', path: '/api/component-details',
    handler: async ({ res, requestUrl }) => {
      const part = requestUrl.searchParams.get('part');
      if (!part) { jsonResponse(res, 400, { error: 'Missing "part" parameter' }); return; }
      jsonResponse(res, 200, await readPartDetails(part));
    },
  });
  const legacyDetails = async ({ res, requestUrl }) => {
    const part = requestUrl.searchParams.get('chip');
    if (!part) { jsonResponse(res, 400, { error: 'Missing "chip" or "part" parameter' }); return; }
    jsonResponse(res, 200, await readPartDetails(part));
  };
  router.register({ id: 'parts.details-legacy', method: 'GET', path: '/api/chip-details', handler: legacyDetails });
  router.register({ id: 'parts.details-legacy-post-compatibility', method: 'POST', path: '/api/chip-details', handler: legacyDetails });
  router.register({ id: 'parts.details-legacy-delete-compatibility', method: 'DELETE', path: '/api/chip-details', handler: legacyDetails });
  return router;
}
