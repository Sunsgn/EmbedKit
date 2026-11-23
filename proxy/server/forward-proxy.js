import http from 'http';
import https from 'https';

const FORWARDED_REQUEST_HEADERS = Object.freeze(['content-type', 'accept', 'authorization']);

export function createForwardProxy({ validateTarget, readRequestBody, jsonResponse, httpClient = http, httpsClient = https }) {
  if (typeof validateTarget !== 'function' || typeof readRequestBody !== 'function' || typeof jsonResponse !== 'function') {
    throw new Error('Forward proxy requires target validation, bounded body reading and JSON errors');
  }

  return async function forwardProxyRequest(req, res, targetValue) {
    let target;
    try {
      target = validateTarget(targetValue);
    } catch (error) {
      jsonResponse(res, 403, { error: error.message });
      return;
    }

    let body;
    try {
      body = await readRequestBody(req);
    } catch (error) {
      if (!res.headersSent) jsonResponse(res, 413, { error: error.message });
      return;
    }

    const headers = {};
    for (const name of FORWARDED_REQUEST_HEADERS) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }
    if (body.length) headers['content-length'] = String(body.length);

    const client = target.protocol === 'https:' ? httpsClient : httpClient;
    const upstream = client.request({
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname + target.search,
      method: req.method,
      headers,
    }, upstreamResponse => {
      const responseHeaders = { ...upstreamResponse.headers };
      for (const name of Object.keys(responseHeaders)) {
        if (name.toLowerCase().startsWith('access-control-')) delete responseHeaders[name];
      }
      res.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
      upstreamResponse.pipe(res);
    });

    upstream.on('error', error => {
      if (res.headersSent) res.destroy(error);
      else jsonResponse(res, 502, { error: error.message });
    });
    upstream.end(body);
  };
}
