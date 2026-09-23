import http from 'http';
import https from 'https';
import { URL } from 'url';

const PORT = process.env.PORT || 9999;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const targetUrl = requestUrl.searchParams.get('target');

  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing target parameter. Usage: /?target=http://localhost:11434/v1/chat/completions' }));
    return;
  }

  // Set CORS headers
  res.writeHead(200, {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  if (req.method === 'OPTIONS') {
    res.end();
    return;
  }

  try {
    const target = new URL(targetUrl);
    const isHttps = target.protocol === 'https:';
    const client = isHttps ? https : http;

    const proxyReq = client.request(
      {
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        path: target.pathname + target.search,
        method: req.method,
        headers: {
          ...req.headers,
          host: `${target.hostname}:${target.port || (isHttps ? 443 : 80)}`,
        },
      },
      (proxyRes) => {
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      res.end(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    });

    req.pipe(proxyReq);
  } catch (err) {
    res.end(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  }
});

server.listen(PORT, () => {
  console.log(`\n✅ EmbedKit CORS Proxy running on port ${PORT}`);
  console.log(`\n使用方法：`);
  console.log(`在 EmbedKit 的 AI 设置中，将 Local 端点地址设置为：`);
  console.log(`  http://localhost:${PORT}/?target=http://localhost:11434/v1/chat/completions`);
  console.log(`\n或对于 LM Studio：`);
  console.log(`  http://localhost:${PORT}/?target=http://localhost:1234/v1/chat/completions`);
  console.log(`\n按 Ctrl+C 停止代理\n`);
});
