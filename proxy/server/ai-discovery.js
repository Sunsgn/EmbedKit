import http from 'http';
import https from 'https';

export const AI_DISCOVERY_ADAPTER_VERSION = 1;
export const AI_DISCOVERY_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export function fetchJson(urlValue, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlValue);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      reject(new Error(`Unsupported discovery protocol: ${url.protocol}`));
      return;
    }
    const client = url.protocol === 'https:' ? https : http;
    const request = client.get(url, { headers: { accept: 'application/json' } }, response => {
      if ((response.statusCode || 500) < 200 || (response.statusCode || 500) >= 300) {
        response.resume();
        reject(new Error(`Discovery request returned HTTP ${response.statusCode || 500}`));
        return;
      }
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > AI_DISCOVERY_MAX_RESPONSE_BYTES) request.destroy(new Error('Discovery response exceeds size limit'));
        else chunks.push(chunk);
      });
      response.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { reject(new Error(`Invalid JSON from ${urlValue}`)); }
      });
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`Discovery request timed out after ${timeoutMs}ms`)));
    request.on('error', reject);
  });
}

const ollamaProbe = {
  id: 'ollama.local', version: '1.0.0', apiVersion: AI_DISCOVERY_ADAPTER_VERSION,
  async detect({ getJson }) {
    const data = await getJson('http://localhost:11434/api/tags', 3000);
    if (!Array.isArray(data?.models)) return [];
    return [{
      name: 'Ollama', url: 'http://localhost:11434', chatUrl: 'http://localhost:11434/v1/chat/completions',
      models: data.models.filter(model => model?.name).map(model => ({
        id: model.name, name: model.name,
        size: model.size ? `${(model.size / 1024 / 1024 / 1024).toFixed(1)} GB` : 'Unknown',
      })),
    }];
  },
};

const lmStudioProbe = {
  id: 'lm-studio.local', version: '1.0.0', apiVersion: AI_DISCOVERY_ADAPTER_VERSION,
  async detect({ getJson }) {
    const data = await getJson('http://localhost:1234/v1/models', 3000);
    if (!Array.isArray(data?.data)) return [];
    return [{
      name: 'LM Studio', url: 'http://localhost:1234', chatUrl: 'http://localhost:1234/v1/chat/completions',
      models: data.data.filter(model => model?.id).map(model => ({ id: model.id, name: model.name || model.id })),
    }];
  },
};

const openAiCompatibleTargets = [
  ['Jan', 'http://localhost:1337'], ['GPT4All', 'http://localhost:4891'],
  ['text-generation-webui', 'http://localhost:5000'], ['KoboldCpp', 'http://localhost:5001'],
  ['vLLM', 'http://localhost:8000'], ['LocalAI / llama.cpp', 'http://localhost:8080'],
];

const openAiCompatibleProbe = {
  id: 'openai-compatible.local', version: '1.0.0', apiVersion: AI_DISCOVERY_ADAPTER_VERSION,
  async detect({ getJson }) {
    const servers = [];
    for (const [name, baseUrl] of openAiCompatibleTargets) {
      try {
        const data = await getJson(`${baseUrl}/v1/models`, 2500);
        const models = Array.isArray(data?.data)
          ? data.data.filter(model => model?.id).map(model => ({ id: model.id, name: model.name || model.id }))
          : [];
        if (models.length) servers.push({ name, url: baseUrl, chatUrl: `${baseUrl}/v1/chat/completions`, models });
      } catch { /* One optional local server must not block the remaining targets. */ }
    }
    return servers;
  },
};

const openCodeProbe = {
  id: 'opencode.local', version: '1.0.0', apiVersion: AI_DISCOVERY_ADAPTER_VERSION,
  async detect({ getJson }) {
    for (const port of [3123, 3000, 8080, 7860]) {
      const baseUrl = `http://localhost:${port}`;
      try {
        const health = await getJson(`${baseUrl}/global/health`, 3000);
        if (!health?.healthy) continue;
        const providerData = await getJson(`${baseUrl}/provider`, 3000);
        const providers = Array.isArray(providerData?.all)
          ? providerData.all
          : providerData?.all && typeof providerData.all === 'object' ? Object.values(providerData.all) : [];
        const models = [], seen = new Set();
        for (const provider of providers) {
          const providerModels = provider?.models && typeof provider.models === 'object' ? Object.values(provider.models) : [];
          for (const model of providerModels) {
            if (!model?.id || seen.has(model.id)) continue;
            seen.add(model.id);
            models.push({ id: model.id, name: model.name || model.id, provider: provider.id || provider.name || 'unknown' });
          }
        }
        return [{ name: 'OpenCode', url: baseUrl, chatUrl: `${baseUrl}/message`, models, version: health.version || 'unknown' }];
      } catch { /* Continue probing the bounded local target registry. */ }
    }
    return [];
  },
};

export const defaultAiDiscoveryProbes = Object.freeze([
  ollamaProbe, lmStudioProbe, openAiCompatibleProbe, openCodeProbe,
]);

export function createAiDiscovery({ getJson = fetchJson, probes = defaultAiDiscoveryProbes } = {}) {
  const compatibleProbes = probes.filter(probe => probe?.apiVersion === AI_DISCOVERY_ADAPTER_VERSION && typeof probe.detect === 'function');
  return {
    async detectServers() {
      const servers = [];
      for (const probe of compatibleProbes) {
        try {
          const detected = await probe.detect({ getJson });
          for (const server of Array.isArray(detected) ? detected : []) {
            if (server?.url && !servers.some(existing => existing.url === server.url)) servers.push(server);
          }
        } catch { /* Discovery is optional and each adapter degrades independently. */ }
      }
      return servers;
    },
  };
}
