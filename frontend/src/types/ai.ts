export const AI_PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (推荐)' },
      { id: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash Preview' },
    ],
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
  },
  openrouter: {
    name: 'OpenRouter',
    models: [
      { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (免费)' },
      { id: 'qwen/qwen-2.5-vl-72b-instruct:free', label: 'Qwen 2.5 VL 72B (免费)' },
      { id: 'meta-llama/llama-3.2-90b-text-preview:free', label: 'Llama 3.2 90B (免费)' },
    ],
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
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
}
