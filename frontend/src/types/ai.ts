export const AI_PROVIDERS = {
  huggingface: {
    name: 'Hugging Face',
    icon: '🤗',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct',
    models: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B' },
      { id: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen 2.5 72B' },
      { id: 'mistralai/Mistral-7B-Instruct-v0.3', label: 'Mistral 7B' },
      { id: 'microsoft/Phi-3-medium-128k-instruct', label: 'Phi-3 Medium' },
    ],
    endpoint: 'https://api-inference.huggingface.co/v1/chat/completions',
    apiKey: '', // built-in, no key needed
    requiresKey: false,
  },
  openrouter: {
    name: 'OpenRouter',
    icon: '🌐',
    defaultModel: 'openrouter/auto',
    models: [
      { id: 'openrouter/auto', label: '自动选择可用模型' },
      { id: 'openrouter/free', label: '自动选择免费模型' },
    ],
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKey: '',
    requiresKey: true,
  },
  gemini: {
    name: 'Google Gemini',
    icon: '🔮',
    defaultModel: 'gemini-2.0-flash',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash Preview' },
    ],
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent',
    apiKey: '',
    requiresKey: true,
  },
  local: {
    name: '本地',
    icon: '🖥️',
    defaultModel: 'qwen2.5:7b',
    models: [
      { id: 'qwen2.5:7b', label: 'Qwen 2.5 7B' },
      { id: 'qwen2.5:14b', label: 'Qwen 2.5 14B' },
      { id: 'llama3.2:3b', label: 'Llama 3.2 3B' },
      { id: 'mistral:7b', label: 'Mistral 7B' },
      { id: 'deepseek-r1:8b', label: 'DeepSeek R1 8B' },
    ],
    endpoint: 'http://localhost:11434/v1/chat/completions',
    apiKey: '',
    requiresKey: false,
  },
  custom: {
    name: '自定义',
    icon: '⚙️',
    defaultModel: 'default',
    models: [{ id: 'default', label: '自定义模型' }],
    endpoint: '',
    apiKey: '',
    requiresKey: false,
  },
} as const;

export type ProviderKey = keyof typeof AI_PROVIDERS;

export interface AiModel {
  id: string;
  label: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AiConfig {
  schemaVersion?: 2;
  provider: ProviderKey;
  model: string;
  apiKey: string;
  customEndpoint?: string;
  customApiKey?: string;
}
