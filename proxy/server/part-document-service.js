import https from 'https';

export const PART_DOCUMENT_API_VERSION = 1;
export const DEFAULT_PART_DOCUMENT_ADAPTERS = [
  { name: 'STMicroelectronics', aliases: ['stmicro', 'st micro'], domains: ['st.com'], pages: model => [`https://www.st.com/content/st_com/en/search.html?q=${encodeURIComponent(model)}`] },
  { name: 'NXP', aliases: ['nxp'], domains: ['nxp.com'], pages: model => [`https://www.nxp.com/part/${encodeURIComponent(model)}`] },
  { name: 'Texas Instruments', aliases: ['texas instruments', 'texas instrument', 'ti'], domains: ['ti.com'], pages: model => [`https://www.ti.com/product/${encodeURIComponent(model)}`] },
  { name: 'Microchip', aliases: ['microchip', 'atmel'], domains: ['microchip.com'], pages: model => [`https://www.microchip.com/en-us/product/${encodeURIComponent(model)}`] },
  { name: 'Nordic Semiconductor', aliases: ['nordic'], domains: ['nordicsemi.com'], pages: model => [`https://www.nordicsemi.com/search?query=${encodeURIComponent(model)}`] },
  { name: 'Infineon', aliases: ['infineon', 'cypress'], domains: ['infineon.com'], pages: model => [`https://www.infineon.com/part/${encodeURIComponent(model)}`] },
  { name: 'Renesas', aliases: ['renesas'], domains: ['renesas.com'], pages: model => [`https://www.renesas.com/en/search?keywords=${encodeURIComponent(model)}`] },
  { name: 'Espressif', aliases: ['espressif'], domains: ['espressif.com'], pages: model => [`https://www.espressif.com/en/search/node?keys=${encodeURIComponent(model)}`] },
  { name: 'GigaDevice', aliases: ['gigadevice', 'gd32'], domains: ['gd-mcu.com', 'gigadevice.com'], pages: model => [`https://www.gigadevice.com/search?keyword=${encodeURIComponent(model)}`] },
  { name: 'WCH', aliases: ['wch', 'nanjing qinheng'], domains: ['wch-ic.com'], pages: model => [`https://www.wch-ic.com/search?q=${encodeURIComponent(model)}`] },
  { name: 'Raspberry Pi', aliases: ['raspberry pi'], domains: ['raspberrypi.com'], pages: model => [`https://www.raspberrypi.com/documentation/microcontrollers/${encodeURIComponent(model.toLowerCase())}.html`] },
  { name: 'Bosch Sensortec', aliases: ['bosch sensortec', 'bosch'], domains: ['bosch-sensortec.com'], pages: model => [`https://www.bosch-sensortec.com/search/?tx_solr%5Bq%5D=${encodeURIComponent(model)}`] },
  { name: 'Analog Devices', aliases: ['analog devices', 'maxim'], domains: ['analog.com'], pages: model => [`https://www.analog.com/en/products/${encodeURIComponent(model.toLowerCase())}.html`] },
  { name: 'Silicon Labs', aliases: ['silicon labs', 'silabs'], domains: ['silabs.com'], pages: model => [`https://www.silabs.com/search#q=${encodeURIComponent(model)}`] },
  { name: 'WIZnet', aliases: ['wiznet'], domains: ['wiznet.io'], pages: model => [`https://docs.wiznet.io/Product/iEthernet/W${encodeURIComponent(model.replace(/^W/i, ''))}/overview`] },
  { name: 'Winbond', aliases: ['winbond'], domains: ['winbond.com'], pages: model => [`https://www.winbond.com/hq/search-result/?q=${encodeURIComponent(model)}`] },
  { name: 'Sensirion', aliases: ['sensirion'], domains: ['sensirion.com'], pages: model => [`https://sensirion.com/products/catalog/${encodeURIComponent(model.toLowerCase())}`] },
];

export function isPartAdapterUrl(value, adapter) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && adapter.domains.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch { return false; }
}

function decodeHtmlText(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

function documentKind(value) {
  const text = value.toLowerCase().replace(/[_-]+/g, ' ');
  if (/errata|erratum/.test(text)) return 'errata';
  if (/programming manual|programmer.?s (?:guide|manual)/.test(text)) return 'programming-manual';
  if (/reference manual|technical reference/.test(text)) return 'reference-manual';
  if (/user (?:guide|manual)|usage manual|evaluation (?:board|kit).*guide/.test(text)) return 'user-guide';
  if (/getting started|quick start/.test(text)) return 'getting-started-guide';
  if (/hardware (?:design|integration)|layout (?:guide|guideline)|design guide/.test(text)) return 'hardware-design-guide';
  if (/application note|app note|design note|\ban\s?\d{2,}/.test(text)) return 'application-note';
  if (/datasheet|data sheet|\bds\d{2,}/.test(text)) return 'datasheet';
  return 'other';
}

export function extractOfficialDocuments(html, pageUrl, adapter, model, { maxHtmlBytes = 2 * 1024 * 1024, maxResults = 24 } = {}) {
  if (typeof html !== 'string' || html.length > maxHtmlBytes || !isPartAdapterUrl(pageUrl, adapter)) return { documents: [], pages: [] };
  const documents = [], pages = [], seen = new Set(), normalizedModel = String(model).toLowerCase().replace(/[^a-z0-9]/g, '');
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    let url; try { url = new URL(match[1], pageUrl); } catch { continue; }
    if (!isPartAdapterUrl(url.toString(), adapter)) continue;
    const label = decodeHtmlText(match[2]), filename = url.pathname.split('/').filter(Boolean).pop() || 'PDF 文档', evidenceText = `${label} ${url.pathname}`, normalizedEvidence = evidenceText.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isPdf = /\.pdf$/i.test(url.pathname) || /\/(?:pdf|lit\/(?:pdf|gpn))(?:\/|$)/i.test(url.pathname) || /[?&](?:format|type)=pdf\b/i.test(url.search);
    if (isPdf) {
      const kind = /\/lit\/gpn\//i.test(url.pathname) ? 'datasheet' : documentKind(evidenceText);
      if (kind === 'other' && normalizedModel && !normalizedEvidence.includes(normalizedModel)) continue;
      const key = url.toString().toLowerCase();
      if (seen.has(key) || documents.length >= maxResults) continue;
      seen.add(key);
      documents.push({ kind, title: !label || /^(?:download|pdf|document-pdfacrobat)$/i.test(label) ? filename : label, url: url.toString(), sourceName: adapter.name, authoritative: true, scope: normalizedModel && normalizedEvidence.includes(normalizedModel) ? 'exact-model' : 'family', discoveredFrom: pageUrl });
      continue;
    }
    if (normalizedModel && normalizedEvidence.includes(normalizedModel) && pages.length < 2 && !seen.has(url.toString())) { seen.add(url.toString()); pages.push(url.toString()); }
  }
  return { documents, pages };
}

export function createPartDocumentService({
  adapters = DEFAULT_PART_DOCUMENT_ADAPTERS,
  agentVersion = '1.0.0',
  maxHtmlBytes = 2 * 1024 * 1024,
  maxPdfBytes = 50 * 1024 * 1024,
  maxResults = 24,
  cacheTtlMs = 10 * 60 * 1000,
  httpsAdapter = https,
} = {}) {
  let registry = adapters;
  const cache = new Map();
  const findAdapter = (manufacturer, productUrl = '') => {
    const name = String(manufacturer || '').trim().toLowerCase(), byName = registry.find(adapter => adapter.aliases.some(alias => name.includes(alias)));
    if (byName) return byName;
    try { const hostname = new URL(productUrl).hostname.toLowerCase(); return registry.find(adapter => adapter.domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))); }
    catch { return undefined; }
  };
  const fetchHtml = (urlStr, adapter, redirects = 2, timeoutMs = 9000) => new Promise((resolve, reject) => {
    if (!isPartAdapterUrl(urlStr, adapter)) { reject(new Error('Document page is outside the selected manufacturer domains')); return; }
    const request = httpsAdapter.get(urlStr, { headers: { 'User-Agent': `EmbedKit-Agent/${agentVersion}`, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.7' } }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirects > 0) { response.resume(); let redirected; try { redirected = new URL(response.headers.location, urlStr).toString(); } catch { reject(new Error('Manufacturer returned an invalid redirect')); return; } fetchHtml(redirected, adapter, redirects - 1, timeoutMs).then(resolve, reject); return; }
      if (response.statusCode < 200 || response.statusCode >= 300) { response.resume(); reject(new Error(`Manufacturer page returned HTTP ${response.statusCode}`)); return; }
      let size = 0, data = '';
      response.on('data', chunk => { size += chunk.length; if (size > maxHtmlBytes) { request.destroy(new Error('Manufacturer page exceeded the HTML size limit')); return; } data += chunk; });
      response.on('end', () => resolve({ html: data, finalUrl: urlStr }));
    });
    request.on('error', reject); request.setTimeout(timeoutMs, () => request.destroy(new Error('Manufacturer document lookup timed out')));
  });
  const fetchPdf = (urlStr, adapter, redirects = 2, timeoutMs = 20_000) => new Promise((resolve, reject) => {
    if (!isPartAdapterUrl(urlStr, adapter)) { reject(new Error('PDF URL is outside the selected manufacturer domains')); return; }
    const request = httpsAdapter.get(urlStr, { headers: { 'User-Agent': `EmbedKit-Agent/${agentVersion}`, Accept: 'application/pdf' } }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirects > 0) { response.resume(); let redirected; try { redirected = new URL(response.headers.location, urlStr).toString(); } catch { reject(new Error('Manufacturer returned an invalid PDF redirect')); return; } fetchPdf(redirected, adapter, redirects - 1, timeoutMs).then(resolve, reject); return; }
      if (response.statusCode < 200 || response.statusCode >= 300) { response.resume(); reject(new Error(`Manufacturer PDF returned HTTP ${response.statusCode}`)); return; }
      const declared = Number(response.headers['content-length'] || 0);
      if (declared > maxPdfBytes) { response.resume(); reject(new Error('Official PDF exceeds the configured size limit')); return; }
      const chunks = []; let size = 0, stopped = false;
      response.on('data', chunk => { if (stopped) return; size += chunk.length; if (size > maxPdfBytes) { stopped = true; request.destroy(new Error('Official PDF exceeds the configured size limit')); return; } chunks.push(chunk); });
      response.on('end', () => { if (stopped) return; const bytes = Buffer.concat(chunks); if (bytes.length < 5 || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') { reject(new Error('Official document response is not a PDF file')); return; } resolve({ bytes, finalUrl: urlStr }); });
    });
    request.on('error', reject); request.setTimeout(timeoutMs, () => request.destroy(new Error('Official PDF download timed out')));
  });
  let htmlFetcher = fetchHtml, binaryFetcher = fetchPdf;
  const configureAdapters = values => { registry = values || DEFAULT_PART_DOCUMENT_ADAPTERS; cache.clear(); };
  const configureFetcher = value => { htmlFetcher = value || fetchHtml; cache.clear(); };
  const configureBinaryFetcher = value => { binaryFetcher = value || fetchPdf; };
  const validateUrl = value => { const adapter = findAdapter('', value); if (!adapter || !isPartAdapterUrl(value, adapter)) throw new Error('PDF URL is not on a registered manufacturer domain'); return { url: new URL(value).toString(), adapter }; };
  const read = async value => { const validated = validateUrl(value), result = await binaryFetcher(validated.url, validated.adapter); if (!result || !Buffer.isBuffer(result.bytes) || result.bytes.length > maxPdfBytes || result.bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Official PDF response failed validation'); if (!isPartAdapterUrl(result.finalUrl || validated.url, validated.adapter)) throw new Error('Official PDF redirect left the manufacturer domain'); return { bytes: result.bytes, finalUrl: result.finalUrl || validated.url, manufacturer: validated.adapter.name }; };
  const discover = async ({ model, manufacturer, productUrl }) => {
    const cleanModel = String(model || '').trim();
    if (cleanModel.length < 2 || cleanModel.length > 120 || !/^[\p{L}\p{N}][\p{L}\p{N}._+\-/ ]*$/u.test(cleanModel)) throw new Error('Invalid part model');
    const adapter = findAdapter(manufacturer, productUrl);
    if (!adapter) return { schemaVersion: 1, model: cleanModel, manufacturer: String(manufacturer || ''), documents: [], failures: [{ code: 'unsupported-manufacturer', message: '暂不支持自动读取该厂商页面' }], discoveredAt: new Date().toISOString() };
    const cacheKey = `${adapter.name}:${cleanModel}:${productUrl || ''}`.toLowerCase(), cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.savedAt < cacheTtlMs) return cached.result;
    const queue = [], supplied = String(productUrl || '');
    if (supplied && isPartAdapterUrl(supplied, adapter)) queue.push(supplied);
    for (const page of adapter.pages(cleanModel)) if (!queue.includes(page)) queue.push(page);
    const documents = [], failures = [], visited = new Set();
    while (queue.length && visited.size < 3 && documents.length < maxResults) {
      const page = queue.shift(); if (visited.has(page)) continue; visited.add(page);
      try { const fetched = await htmlFetcher(page, adapter), extracted = extractOfficialDocuments(fetched.html, fetched.finalUrl || page, adapter, cleanModel, { maxHtmlBytes, maxResults }); for (const document of extracted.documents) if (!documents.some(item => item.url.toLowerCase() === document.url.toLowerCase())) documents.push(document); for (const nextPage of extracted.pages) if (!visited.has(nextPage) && queue.length < 4) queue.push(nextPage); }
      catch (error) { failures.push({ code: 'manufacturer-page-unavailable', message: String(error.message || error).slice(0, 300), url: page }); }
    }
    const result = { schemaVersion: 1, model: cleanModel, manufacturer: adapter.name, documents: documents.slice(0, maxResults), failures: failures.slice(0, 3), discoveredAt: new Date().toISOString(), limits: { maxDocuments: maxResults, maxPages: 3, cacheSeconds: cacheTtlMs / 1000 } };
    cache.set(cacheKey, { savedAt: Date.now(), result }); while (cache.size > 64) cache.delete(cache.keys().next().value); return result;
  };
  return { apiVersion: PART_DOCUMENT_API_VERSION, configureAdapters, configureFetcher, configureBinaryFetcher, validateUrl, read, discover };
}
