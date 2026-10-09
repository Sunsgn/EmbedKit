import { AI_PROVIDERS, type AiConfig } from '../types/ai';

const SYSTEM_PROMPT = `你是一个通用嵌入式工程分析助手。你必须依据用户提供的真实工程文件、编译配置、SDK信息和官方资料进行判断，不得把未知平台臆测成STM32或ESP32。
请用中文回答用户的问题。回答时注意：
1. 代码示例使用C语言，配合HAL库或标准库
2. 解释要简洁明了，重点突出
3. 如果涉及硬件操作，说明引脚配置和注意事项
4. 代码中不要添加注释，保持简洁`;

export const LOCAL_PROXY_BASE = (import.meta.env.VITE_LOCAL_PROXY_URL || 'http://127.0.0.1:9999').replace(/\/+$/, '');

export function localProxyUrl(target: string): string {
  return `${LOCAL_PROXY_BASE}/proxy/${target}`;
}

const AI_CONFIG_KEY = 'embedkit-ai-config';
const AI_SECRETS_KEY = 'embedkit-ai-secrets';

export function loadStoredAiConfig(): AiConfig | null {
  try {
    const saved = localStorage.getItem(AI_CONFIG_KEY);
    if (!saved) return null;
    const config = JSON.parse(saved) as AiConfig;
    const secrets = JSON.parse(sessionStorage.getItem(AI_SECRETS_KEY) || '{}') as Partial<AiConfig>;
    return { ...config, apiKey: secrets.apiKey || config.apiKey || '', customApiKey: secrets.customApiKey || config.customApiKey || '' };
  } catch {
    return null;
  }
}

export function persistAiConfig(config: AiConfig): void {
  const { apiKey, customApiKey, ...persistentConfig } = config;
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify({ ...persistentConfig, apiKey: '', customApiKey: '' }));
  sessionStorage.setItem(AI_SECRETS_KEY, JSON.stringify({ apiKey, customApiKey }));
}

export function clearStoredAiConfig(): void {
  localStorage.removeItem(AI_CONFIG_KEY);
  sessionStorage.removeItem(AI_SECRETS_KEY);
}

export interface LocalServer {
  name: string;
  url: string;
  chatUrl: string;
  models: Array<{ id: string; name: string; size?: string }>;
}

export async function detectLocalServers(): Promise<LocalServer[]> {
  try {
    const res = await fetch(`${LOCAL_PROXY_BASE}/api/servers`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.servers || [];
  } catch {
    return [];
  }
}

export async function fetchLocalModels(serverName: string): Promise<Array<{ id: string; name: string; size?: string }>> {
  try {
    const res = await fetch(`${LOCAL_PROXY_BASE}/api/models?server=${encodeURIComponent(serverName)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.models || [];
  } catch {
    return [];
  }
}

export async function streamAiResponse(
  config: AiConfig,
  messages: Array<{ role: string; content: string }>,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
) {
  const provider = AI_PROVIDERS[config.provider];
  if (!provider) {
    onError('未知的模型提供商');
    return;
  }

  let endpoint: string = provider.endpoint;
  let apiKey: string = provider.apiKey || config.apiKey || '';

  if (config.provider === 'custom') {
    endpoint = config.customEndpoint || '';
    apiKey = config.customApiKey || '';
    if (!endpoint) {
      onError('请先配置自定义 API 地址');
      return;
    }
  }

  if (config.provider === 'local') {
    endpoint = config.customEndpoint || provider.endpoint;
    apiKey = config.customApiKey || '';
  }

  if (provider.requiresKey && !apiKey) {
    onError('请先配置 API Key');
    return;
  }

  try {
    if (config.provider === 'gemini') {
      await streamGemini(config, messages, endpoint, apiKey, onChunk, onDone, onError);
    } else {
      await streamOpenAIFormat(config, messages, endpoint, apiKey, onChunk, onDone, onError);
    }
  } catch (e: any) {
    const msg = e.message || e.toString() || '请求失败';
    if ((msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS'))) {
      if (config.provider === 'local') {
        onError(`本地请求被浏览器或代理阻止。\n\n请确认已运行：\ncd EmbedKit/proxy && npm start\n\n默认代理地址：${LOCAL_PROXY_BASE}\n如使用其他地址，请在构建时设置 VITE_LOCAL_PROXY_URL。`);
      } else if (config.provider === 'huggingface') {
        onError('Hugging Face 请求被浏览器 CORS 策略阻止。请切换为 OpenRouter 或其他提供商，或切换到模拟模式。');
      } else {
        onError(`请求被浏览器阻止 (CORS/Network)。请检查服务器是否配置了 CORS 头允许 ${window.location.origin} 访问。`);
      }
    } else {
      onError(msg);
    }
  }
}

async function streamGemini(
  config: AiConfig,
  messages: Array<{ role: string; content: string }>,
  endpoint: string,
  apiKey: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
) {
  const url = endpoint.replace('{model}', config.model);

  const geminiMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(`${url}?key=${apiKey}&alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: geminiMessages,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    onError(`Gemini API 错误 (${response.status}): ${err}`);
    return;
  }

  await readStream(response, onChunk, onDone, (text) => {
    try {
      const json = JSON.parse(text);
      const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
      return content || '';
    } catch {
      return '';
    }
  }, onError);
}

async function streamOpenAIFormat(
  config: AiConfig,
  messages: Array<{ role: string; content: string }>,
  endpoint: string,
  apiKey: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
) {
  const orMessages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...messages,
  ];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.provider === 'huggingface' || config.provider === 'local') {
    // Hugging Face doesn't need auth header for unauthenticated access
    // Local provider may not need auth header (Ollama)
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'EmbedKit AI';
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: orMessages,
      stream: true,
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    const providerName = AI_PROVIDERS[config.provider]?.name || config.provider;
    onError(`${providerName} API 错误 (${response.status}): ${err}`);
    return;
  }

  await readStream(response, onChunk, onDone, (text) => {
    try {
      const json = JSON.parse(text);
      return json.choices?.[0]?.delta?.content || '';
    } catch {
      return '';
    }
  }, onError);
}

async function readStream(
  response: Response,
  onChunk: (text: string) => void,
  onDone: () => void,
  extractText: (jsonStr: string) => string,
  onError: (error: string) => void,
) {
  const reader = response.body?.getReader();
  if (!reader) {
    onError('不支持流式响应');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6).trim();
          if (data && data !== '[DONE]') {
            const text = extractText(data);
            if (text) {
              onChunk(text);
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  onDone();
}
