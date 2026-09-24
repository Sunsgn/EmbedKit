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

function fetchHTML(urlStr, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Timeout after ${timeoutMs}ms for ${urlStr}`));
    });
  });
}

function fetchSnapEDAJSON(urlStr, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.snapeda.com/',
        'Origin': 'https://www.snapeda.com',
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Invalid JSON from SnapEDA: ${data.substring(0, 100)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Timeout after ${timeoutMs}ms for SnapEDA: ${urlStr}`));
    });
  });
}

async function getSnapEDASpecs(chipName) {
  const result = {
    productName: '',
    productFamily: '',
    description: '',
    specs: {},
    features: [],
    hierarchy: [],
    stUrl: '',
    source: 'SnapEDA/Mouser',
  };

  try {
    const suggestions = await fetchSnapEDAJSON(`https://www.snapeda.com/api/v1/search_autocomplete?q=${chipName}`);
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return null;
    }

    const partNames = [chipName, ...suggestions.filter(s => s.startsWith(chipName))];
    let partData = null;

    for (const partName of partNames) {
      const data = await fetchSnapEDAJSON(`https://www.snapeda.com/api/get_mouser_info_api?part_name=${partName}`);
      if (data && data.ManufacturerPartNumber) {
        partData = data;
        break;
      }
    }

    if (!partData) {
      return null;
    }

    result.productName = partData.ManufacturerPartNumber;
    result.productFamily = partData.Category || '';
    result.description = partData.Description || '';
    result.specs = {
      manufacturer: partData.Manufacturer || '',
      category: partData.Category || '',
      price: partData.Price || '',
      stock: partData.AvailabilityInStock || 'N/A',
      rohs: partData.ROHSStatus || '',
      lifecycle: partData.LifecycleStatus || '',
    };

    if (partData.DataSheetUrl) {
      result.stUrl = partData.DataSheetUrl;
    }

    if (partData.ProductAttributes) {
      const seen = new Set();
      partData.ProductAttributes.forEach(attr => {
        const key = attr.AttributeName;
        if (!seen.has(key)) {
          result.specs[key.toLowerCase()] = attr.AttributeValue;
          seen.add(key);
        }
      });
    }

    const desc = partData.Description || '';
    const clockMatch = desc.match(/(\d+)\s*MHz/);
    if (clockMatch) result.specs.maxClock = `${clockMatch[1]} MHz`;
    const flashMatch = desc.match(/(\d+)\s*[Kk](?:bytes?)?\s*Flash/i);
    if (flashMatch) result.specs.flashMemory = `${flashMatch[1]} KB Flash`;
    const sramMatch = desc.match(/(\d+)\s*[Kk](?:bytes?)?\s*RAM/i);
    if (sramMatch) result.specs.sram = `${sramMatch[1]} KB RAM`;

    const mouserUrl = partData.ProductDetailUrl;
    if (mouserUrl) {
      result.mouserUrl = mouserUrl;
    }

    if (partData.SuggestedReplacement && partData.SuggestedReplacement.length > 0) {
      result.alternatives = partData.SuggestedReplacement.slice(0, 5);
    }

    return result;
  } catch (e) {
    console.log(`SnapEDA lookup failed: ${e.message}`);
    return null;
  }
}

function parseSTProduct(html) {
  const result = {
    productName: '',
    productFamily: '',
    description: '',
    specs: {},
    features: [],
    hierarchy: [],
    stUrl: '',
  };

  // Extract meta description
  const metaDesc = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  if (metaDesc) result.description = metaDesc.replace(/&[^;]+;/g, ' ');

  // Extract from window.digitalData
  const dataMatch = html.match(/window\.digitalData\s*=\s*({[\s\S]*?});/);
  if (dataMatch) {
    try {
      const digitalData = JSON.parse(dataMatch[1]);
      const prod = digitalData.product?.[0]?.productInfo;
      if (prod) {
        result.productName = prod.productName || '';
        result.specs = { ...prod };
        const tree = prod.tree || {};
        result.productFamily = tree.level4 || tree.level3 || '';
      }
    } catch (e) {}
  }

  // Extract JSON-LD breadcrumbs
  const jsonLdScripts = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  if (jsonLdScripts) {
    jsonLdScripts.forEach(script => {
      const json = script.replace(/<script[^>]*>|<\/script>/g, '').trim();
      try {
        const data = JSON.parse(json);
        if (data.itemListElement) {
          data.itemListElement.forEach(item => {
            result.hierarchy.push({ name: item.item?.['@type'] === 'WebPage' ? item.name : item.name, url: item.item });
          });
        }
      } catch (e) {}
    });
  }

  // Extract from st-stage-product__copy (short product description)
  const copyMatch = html.match(/<span class="st-stage-product__copy">([\s\S]*?)<\/span>/);
  if (copyMatch) {
    result.shortDescription = copyMatch[1].replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Extract from og:description
  const ogDescMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
  if (ogDescMatch) {
    result.ogDescription = ogDescMatch[1].replace(/&[^;]+;/g, ' ');
  }

  // Extract main product description from overview text
  const overviewIdx = html.indexOf('st-overview');
  if (overviewIdx > 0) {
    const overviewSection = html.slice(overviewIdx, overviewIdx + 3000);
    const textMatch = overviewSection.match(/>([^<]{50,})</);
    if (textMatch && !result.description) {
      result.description = textMatch[1].replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  // Fallback: extract from og:description
  if (!result.description && result.ogDescription) {
    result.description = result.ogDescription;
  }

  // Extract "All features" section
  const featuresIdx = html.indexOf('All features');
  if (featuresIdx > 0) {
    const section = html.slice(featuresIdx, featuresIdx + 5000);
    const text = section.replace(/<[^>]*>/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && l !== 'All features');
    result.features = lines.slice(0, 40);
  }

  // Extract key specs from description and features
  const clockMatch = html.match(/(\d+)\s*MHz/);
  if (clockMatch) result.specs.maxClock = `${clockMatch[1]} MHz`;

  const flashMatch = html.match(/(\d+)\s*Kbytes?\s*of\s*Flash/i);
  if (flashMatch) result.specs.flashMemory = `${flashMatch[1]} KB Flash`;

  const sramMatch = html.match(/(\d+)\s*Kbytes?\s*of\s*SRAM/i);
  if (sramMatch) result.specs.sram = `${sramMatch[1]} KB SRAM`;

  const voltageMatch = html.match(/([\d.]+)\s*to\s*([\d.]+)\s*V/i);
  if (voltageMatch) result.specs.voltageRange = `${voltageMatch[1]}-${voltageMatch[2]} V`;

  const adcMatch = html.match(/(\d+)x\s*(\d+)-bit.*ADC/i);
  if (adcMatch) result.specs.adc = `${adcMatch[1]}x ${adcMatch[2]}-bit ADC`;

  return result;
}

async function getChipDetails(chipName) {
  const rule = detectManufacturer(chipName);
  const productUrl = rule ? rule.productUrl(chipName) : null;
  const snapResult = await getSnapEDASpecs(chipName);
  if (snapResult && snapResult.description && snapResult.description !== 'N/A') {
    if (productUrl) snapResult.productUrl = productUrl;
    return snapResult;
  }

  return {
    error: `No data found for ${chipName}`,
    productUrl: productUrl || `https://www.snapeda.com/search?q=${encodeURIComponent(chipName)}`,
    source: 'Unavailable',
  };
}

function generateStUrlCandidates(name) {
  return [name.toLowerCase()];
}

function detectManufacturer(name) {
  const n = name.toUpperCase();
  const manufacturerRules = [
    { name: 'STMicroelectronics', prefixes: ['STM32', 'STM8'], productUrl: q => `https://www.st.com/en/microcontrollers-microprocessors/${generateStUrlCandidates(q)[0]}.html` },
    { name: 'Texas Instruments', prefixes: ['MSP430', 'LM4F', 'TM4C'], productUrl: q => `https://www.ti.com/product/${q}` },
    { name: 'Espressif', prefixes: ['ESP'], productUrl: q => `https://www.espressif.com/en/products/socs/details/${q.toLowerCase()}` },
    { name: 'Raspberry Pi', prefixes: ['RP2'], productUrl: q => `https://www.raspberrypi.com/documentation/microcontrollers/${q.toLowerCase()}.html` },
  ];
  for (const rule of manufacturerRules) {
    for (const prefix of rule.prefixes) {
      if (n.startsWith(prefix.toUpperCase())) {
        return rule;
      }
    }
  }
  return null;
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

const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms))]);

async function detectServers() {
  const servers = [];
  
  const commonPorts = [3123, 3000, 8080, 7860, 11434, 1234];
  
  try {
    const ollamaData = await withTimeout(fetchJSON('http://localhost:11434/api/tags'), 3000);
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
    const lmData = await withTimeout(fetchJSON('http://localhost:1234/v1/models'), 3000);
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
    try {
      const opencodeServer = await withTimeout(detectOpencodeServer(baseURL), 5000);
      if (opencodeServer) {
        servers.push(opencodeServer);
        break;
      }
    } catch (e) { }
  }

  return servers;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = requestUrl.pathname;

  if (req.method === 'OPTIONS') { setCORS(res); res.end(); return; }

  if (pathname === '/api/chip-details') {
    const chipName = requestUrl.searchParams.get('chip');
    if (!chipName) {
      jsonRes(res, 400, { error: 'Missing "chip" parameter' });
      return;
    }
    const details = await getChipDetails(chipName);
    jsonRes(res, 200, details);
    return;
  }

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

  jsonRes(res, 400, { error: 'Unknown path. Use /api/chip-details?chip=<name>, /api/servers, /api/models, or /proxy/<url>' });
});

server.listen(PORT, async () => {
  console.log(`\n✅ EmbedKit CORS Proxy running on http://localhost:${PORT}`);
  const servers = await detectServers();
  if (servers.length > 0) {
    console.log(`\n🔍 Detected local AI servers:`);
    for (const s of servers) {
      console.log(`   ${s.name} at ${s.url} — ${s.models.length} model(s)`);
      const shown = s.models.slice(0, 5);
      for (const m of shown) {
        console.log(`     • ${m.name}`);
      }
      if (s.models.length > 5) {
        console.log(`     ... and ${s.models.length - 5} more`);
      }
    }
  } else {
    console.log(`\n⚠️  No local AI servers detected. Start Ollama or LM Studio.`);
  }
  console.log(`\n在 EmbedKit 中设置端点为: http://localhost:${PORT}/proxy/http://localhost:11434/v1/chat/completions`);
  console.log(`\n按 Ctrl+C 停止代理\n`);
});
