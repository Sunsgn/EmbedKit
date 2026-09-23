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
    defaultModel: 'google/gemini-2.0-flash-exp:free',
    models: [
      { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (免费)' },
      { id: 'qwen/qwen-2.5-vl-72b-instruct:free', label: 'Qwen 2.5 VL 72B (免费)' },
      { id: 'deepseek/deepseek-chat:free', label: 'DeepSeek V3 (免费)' },
      { id: 'deepseek/deepseek-r1-distill-qwen-32b:free', label: 'DeepSeek R1 Distill (免费)' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (免费)' },
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
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
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
  provider: ProviderKey;
  model: string;
  apiKey: string;
  customEndpoint?: string;
  customApiKey?: string;
}
