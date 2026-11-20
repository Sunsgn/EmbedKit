import { AGENT_PROTOCOL_VERSION } from '../../contracts/agent-api.js';

export function createHttpBoundary({ allowedOrigins: configuredOrigins, maxRequestBytes }) {
  const allowedOrigins = new Set(configuredOrigins);

  const isAllowedOrigin = origin => !origin || allowedOrigins.has(origin);

  const setCors = (req, res) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      if (req.headers['access-control-request-private-network'] === 'true') res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-EmbedKit-Protocol');
    res.setHeader('Access-Control-Expose-Headers', 'X-EmbedKit-Protocol, Content-Disposition, Content-Length, X-EmbedKit-Source-Url');
    res.setHeader('X-EmbedKit-Protocol', String(AGENT_PROTOCOL_VERSION));
  };

  const jsonResponse = (res, status, value) => {
    let data = value;
    if (status >= 400 && typeof data?.error === 'string') {
      const message = data.error;
      data = { ...data, code: data.code || (status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : status === 405 ? 'METHOD_NOT_ALLOWED' : status >= 500 ? 'AGENT_INTERNAL_ERROR' : 'INVALID_REQUEST'), message, details: data.details ?? null, recoverable: status < 500 };
    }
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  const readRequestBody = req => new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0, tooLarge = false;
    req.on('data', chunk => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > maxRequestBytes) { tooLarge = true; reject(new Error(`Request body exceeds ${maxRequestBytes} bytes`)); return; }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!tooLarge) resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });

  const readJsonBody = async req => {
    const body = await readRequestBody(req);
    if (!body.length) return {};
    try { return JSON.parse(body.toString('utf8')); }
    catch { throw new Error('Request body must be valid JSON'); }
  };

  return Object.freeze({ isAllowedOrigin, setCors, jsonResponse, readJsonBody });
}
