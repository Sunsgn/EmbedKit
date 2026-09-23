import http from 'http';
import https from 'https';
import { URL } from 'url';

const PORT = process.env.PORT || 9999;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function jsonRes(res, status, data) {
  setCORS(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function fetchJSON(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const client = url.protocol === 'https:' ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Invalid JSON from ${urlStr}`)); }
      });
    }).on('error', reject);
  });
}

function proxyRequest(req, res, targetUrl) {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.end(); return; }

  const target = new URL(targetUrl);
  const isHttps = target.protocol === 'https:';
  const client = isHttps ? https : http;

  const headers = { ...req.headers };
  delete headers.host;
  headers.host = `${target.hostname}:${target.port || (isHttps ? 443 : 80)}`;

  const proxyReq = client.request({
    hostname: target.hostname,
    port: target.port || (isHttps ? 443 : 80),
    path: target.pathname + target.search,
    method: req.method,
    headers,
  }, (proxyRes) => {
    const contentType = proxyRes.headers['content-type'] || '';
    res.writeHead(proxyRes.statusCode, {
      ...proxyRes.headers,
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS,
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    jsonRes(res, 502, { error: err.message });
  });
  req.pipe(proxyReq);
}

function postJSON(urlStr, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const client = url.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const req = client.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(responseData)); }
        catch (e) { reject(new Error(`Invalid JSON from ${urlStr}`)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function detectOpencodeServer(baseURL) {
  const healthUrl = `${baseURL}/global/health`;
  const providerUrl = `${baseURL}/provider`;
  
  try {
    const health = await fetchJSON(healthUrl);
    if (!health || !health.healthy) {
      return null;
    }

    const providerData = await fetchJSON(providerUrl);
    if (!providerData || !providerData.all) {
      return null;
    }

    const models = [];
    const seenIds = new Set();
    
    const providers = Array.isArray(providerData.all) ? providerData.all : 
                      (providerData.all && typeof providerData.all === 'object' ? 
                       Object.values(providerData.all) : []);
    
    for (const provider of providers) {
      if (!provider || !provider.models) continue;
      
      const providerId = provider.id || provider.name || 'unknown';
      const providerModels = typeof provider.models === 'object' ? 
                             Object.values(provider.models) : [];
      
      for (const model of providerModels) {
        if (model && model.id && !seenIds.has(model.id)) {
          seenIds.add(model.id);
          models.push({
            id: model.id,
            name: model.name || model.id,
            provider: providerId,
          });
        }
      }
    }

    return {
      name: 'OpenCode',
      url: baseURL,
      chatUrl: `${baseURL}/message`,
      models,
      version: health.version || 'unknown',
    };
  } catch (e) {
    return null;
  }
}

async function detectServers() {
  const servers = [];
  
  const commonPorts = [3123, 3000, 8080, 7860, 11434, 1234];
  
  try {
    const ollamaData = await fetchJSON('http://localhost:11434/api/tags');
    if (ollamaData && ollamaData.models) {
      servers.push({
        name: 'Ollama',
        url: 'http://localhost:11434',
        chatUrl: 'http://localhost:11434/v1/chat/completions',
        models: ollamaData.models.map((m) => ({
          id: m.name,
          name: m.name,
          size: m.size ? `${(m.size / 1024 / 1024 / 1024).toFixed(1)} GB` : 'Unknown',
        })),
      });
    }
  } catch (e) { }

  try {
    const lmData = await fetchJSON('http://localhost:1234/v1/models');
    if (lmData && lmData.data) {
      servers.push({
        name: 'LM Studio',
        url: 'http://localhost:1234',
        chatUrl: 'http://localhost:1234/v1/chat/completions',
        models: lmData.data.map((m) => ({
          id: m.id,
          name: m.id,
        })),
      });
    }
  } catch (e) { }

  for (const port of commonPorts) {
    if (port === 11434 || port === 1234) continue;
    const baseURL = `http://localhost:${port}`;
    const opencodeServer = await detectOpencodeServer(baseURL);
    if (opencodeServer) {
      servers.push(opencodeServer);
      break;
    }
  }

  return servers;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = requestUrl.pathname;

  if (req.method === 'OPTIONS') { setCORS(res); res.end(); return; }

  if (pathname === '/api/servers') {
    const servers = await detectServers();
    jsonRes(res, 200, { servers });
    return;
  }

  if (pathname === '/api/models') {
    const serverName = requestUrl.searchParams.get('server');
    const servers = await detectServers();
    const matched = servers.find(s => s.name.toLowerCase() === serverName?.toLowerCase());
    if (matched) {
      jsonRes(res, 200, { models: matched.models, server: matched.name });
    } else {
      jsonRes(res, 404, { error: `Server "${serverName}" not found` });
    }
    return;
  }

  if (pathname.startsWith('/proxy/')) {
    const targetUrl = pathname.slice(7);
    if (targetUrl) {
      proxyRequest(req, res, targetUrl);
      return;
    }
  }

  const targetUrl = requestUrl.searchParams.get('target');
  if (targetUrl) {
    proxyRequest(req, res, targetUrl);
    return;
  }

  jsonRes(res, 400, { error: 'Unknown path. Use /api/servers, /api/models, or /proxy/<url>' });
});

server.listen(PORT, async () => {
  console.log(`\n✅ EmbedKit CORS Proxy running on http://localhost:${PORT}`);
  const servers = await detectServers();
  if (servers.length > 0) {
    console.log(`\n🔍 Detected local AI servers:`);
    for (const s of servers) {
      console.log(`   ${s.name} at ${s.url} — ${s.models.length} model(s)`);
      for (const m of s.models) {
        console.log(`     • ${m.name}`);
      }
    }
  } else {
    console.log(`\n⚠️  No local AI servers detected. Start Ollama or LM Studio.`);
  }
  console.log(`\n在 EmbedKit 中设置端点为: http://localhost:${PORT}/proxy/http://localhost:11434/v1/chat/completions`);
  console.log(`\n按 Ctrl+C 停止代理\n`);
});
