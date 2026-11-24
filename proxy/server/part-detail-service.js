import https from 'https';

export const PART_DETAIL_API_VERSION = 1;

export const DEFAULT_PART_PRODUCT_RULES = [
  { name: 'STMicroelectronics', prefixes: ['STM32', 'STM8'], productUrl: model => `https://www.st.com/en/microcontrollers-microprocessors/${model.toLowerCase()}.html` },
  { name: 'Texas Instruments', prefixes: ['MSP430', 'LM4F', 'TM4C'], productUrl: model => `https://www.ti.com/product/${model}` },
  { name: 'Espressif', prefixes: ['ESP'], productUrl: model => `https://www.espressif.com/en/products/socs/details/${model.toLowerCase()}` },
  { name: 'Raspberry Pi', prefixes: ['RP2'], productUrl: model => `https://www.raspberrypi.com/documentation/microcontrollers/${model.toLowerCase()}.html` },
];

function normalizeSnapEdaPart(partData) {
  if (!partData?.ManufacturerPartNumber) return null;
  const result = {
    productName: partData.ManufacturerPartNumber,
    productFamily: partData.Category || '',
    manufacturer: partData.Manufacturer || '',
    description: partData.Description || '',
    specs: {
      manufacturer: partData.Manufacturer || '',
      category: partData.Category || '',
      price: partData.Price || '',
      stock: partData.AvailabilityInStock || 'N/A',
      rohs: partData.ROHSStatus || '',
      lifecycle: partData.LifecycleStatus || '',
    },
    features: [], hierarchy: [], stUrl: '', datasheetUrl: '', productUrl: '', source: 'SnapEDA/Mouser',
  };
  if (partData.DataSheetUrl) result.stUrl = result.datasheetUrl = partData.DataSheetUrl;
  const seen = new Set();
  for (const attribute of Array.isArray(partData.ProductAttributes) ? partData.ProductAttributes : []) {
    const key = String(attribute.AttributeName || '');
    if (key && !seen.has(key)) { result.specs[key.toLowerCase()] = attribute.AttributeValue; seen.add(key); }
  }
  const description = partData.Description || '', clock = description.match(/(\d+)\s*MHz/), flash = description.match(/(\d+)\s*[Kk](?:bytes?)?\s*Flash/i), sram = description.match(/(\d+)\s*[Kk](?:bytes?)?\s*RAM/i);
  if (clock) result.specs.maxClock = `${clock[1]} MHz`;
  if (flash) result.specs.flashMemory = `${flash[1]} KB Flash`;
  if (sram) result.specs.sram = `${sram[1]} KB RAM`;
  if (partData.ProductDetailUrl) result.mouserUrl = partData.ProductDetailUrl;
  if (Array.isArray(partData.SuggestedReplacement) && partData.SuggestedReplacement.length) result.alternatives = partData.SuggestedReplacement.slice(0, 5);
  return result;
}

export function createPartDetailService({
  providers,
  productRules = DEFAULT_PART_PRODUCT_RULES,
  httpsAdapter = https,
  maxResponseBytes = 2 * 1024 * 1024,
  timeoutMs = 10_000,
} = {}) {
  const fetchJson = urlString => new Promise((resolve, reject) => {
    const url = new URL(urlString);
    if (url.protocol !== 'https:' || url.hostname !== 'www.snapeda.com' || url.username || url.password) { reject(new Error('Part provider URL is not allowed')); return; }
    const request = httpsAdapter.get(url, { headers: { 'User-Agent': 'EmbedKit-Agent/1.0', Accept: 'application/json', Referer: 'https://www.snapeda.com/' } }, response => {
      if (response.statusCode < 200 || response.statusCode >= 300) { response.resume(); reject(new Error(`Part provider returned HTTP ${response.statusCode}`)); return; }
      let data = '', size = 0;
      response.on('data', chunk => { size += chunk.length; if (size > maxResponseBytes) { request.destroy(new Error('Part provider response exceeded the size limit')); return; } data += chunk; });
      response.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Part provider returned invalid JSON')); } });
    });
    request.on('error', reject); request.setTimeout(timeoutMs, () => request.destroy(new Error('Part provider request timed out')));
  });
  const snapEdaProvider = {
    id: 'snapeda-mouser',
    async lookup(model) {
      const suggestions = await fetchJson(`https://www.snapeda.com/api/v1/search_autocomplete?q=${encodeURIComponent(model)}`);
      if (!Array.isArray(suggestions) || !suggestions.length) return null;
      const candidates = [...new Set([model, ...suggestions.filter(value => typeof value === 'string' && value.toUpperCase().startsWith(model.toUpperCase()))])].slice(0, 8);
      for (const candidate of candidates) {
        const data = await fetchJson(`https://www.snapeda.com/api/get_mouser_info_api?part_name=${encodeURIComponent(candidate)}`);
        const normalized = normalizeSnapEdaPart(data); if (normalized) return normalized;
      }
      return null;
    },
  };
  let registry = providers || [snapEdaProvider];
  const configureProviders = values => { registry = values || [snapEdaProvider]; };
  const lookup = async modelValue => {
    const model = String(modelValue || '').trim();
    if (model.length < 2 || model.length > 120 || !/^[\p{L}\p{N}][\p{L}\p{N}._+\-/ ]*$/u.test(model)) throw new Error('Invalid part model');
    const upper = model.toUpperCase(), productRule = productRules.find(rule => rule.prefixes.some(prefix => upper.startsWith(prefix.toUpperCase()))), productUrl = productRule?.productUrl(model) || '';
    const failures = [];
    for (const provider of registry.slice(0, 8)) {
      if (!provider || typeof provider.lookup !== 'function' || typeof provider.id !== 'string') { failures.push({ provider: provider?.id || 'unknown', code: 'invalid-provider' }); continue; }
      try { const result = await provider.lookup(model); if (result?.description && result.description !== 'N/A') return { ...result, productUrl: productUrl || result.productUrl || '' }; }
      catch (error) { failures.push({ provider: provider.id, code: 'lookup-failed', message: String(error.message || error).slice(0, 300) }); }
    }
    return { error: `No data found for ${model}`, productUrl: productUrl || `https://www.snapeda.com/search?q=${encodeURIComponent(model)}`, source: 'Unavailable', failures };
  };
  return { apiVersion: PART_DETAIL_API_VERSION, configureProviders, lookup };
}
