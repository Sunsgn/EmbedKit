import type { FileNode } from '../../types';
import type { AiConfig } from '../../types/ai';
import { AI_PROVIDERS } from '../../types/ai';
import { loadStoredAiConfig, localProxyUrl, streamAiResponse } from '../../services/aiService';
import type { ProjectSummary } from './projectSummary';

const UNAVAILABLE_MESSAGE = '尚未连接真实 AI。请先进入“AI 助手”页面配置可用模型、API 地址和密钥；工程分析不会使用模拟回答。';

interface ProjectAiDependencies {
  loadConfig: typeof loadStoredAiConfig;
  proxyUrl: typeof localProxyUrl;
  stream: typeof streamAiResponse;
}

const defaultDependencies: ProjectAiDependencies = { loadConfig: loadStoredAiConfig, proxyUrl: localProxyUrl, stream: streamAiResponse };

export interface ProjectAiCallbacks {
  confirmExternal: (message: string) => boolean;
  onStart: () => void;
  onChunk: (chunk: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

function defaultLocalConfig(proxyUrl: typeof localProxyUrl): AiConfig {
  return { provider: 'local', model: 'qwen2.5:7b', apiKey: '', customEndpoint: proxyUrl('http://localhost:11434/v1/chat/completions') };
}

function resolveConfig(dependencies: ProjectAiDependencies): AiConfig {
  const fallback = defaultLocalConfig(dependencies.proxyUrl);
  try {
    const saved = dependencies.loadConfig() || fallback;
    return saved.provider === 'huggingface' && !saved.apiKey ? fallback : saved;
  } catch {
    return fallback;
  }
}

function usableConfig(config: AiConfig) {
  const provider = AI_PROVIDERS[config.provider];
  if (!provider || !config.model) return null;
  const hasEndpoint = config.provider === 'custom' ? Boolean(config.customEndpoint)
    : config.provider === 'local' ? Boolean(config.customEndpoint || provider.endpoint)
      : Boolean(provider.endpoint);
  const hasCredential = !provider.requiresKey || Boolean(config.apiKey || config.customApiKey);
  return hasEndpoint && hasCredential ? provider : null;
}

export function buildProjectAiPrompt(files: readonly FileNode[], summary: ProjectSummary) {
  const source = files.filter(file => /\.(c|cc|cpp|h|hpp)$/i.test(file.name))
    .map(file => `\n===== ${file.path} =====\n${file.content.slice(0, 12000)}`)
    .join('\n')
    .slice(0, 50000);
  return `请分析下面导入的嵌入式工程。只能根据提供的工程事实和代码判断，不要臆测未提供的芯片或 SDK。\n\n工程摘要：${JSON.stringify(summary, null, 2)}\n\n源码片段：${source}\n\n请用中文输出：\n1. 工程实际使用的芯片、工具链、SDK依据\n2. 外设和关键入口的用途\n3. 明确指出至少 3 个风险或待验证项，并引用文件路径\n4. 给出按优先级排序的修改建议\n5. 无法确认的内容标记“需要官方手册或硬件验证”`;
}

export async function runProjectAiAnalysis(
  files: readonly FileNode[],
  summary: ProjectSummary,
  callbacks: ProjectAiCallbacks,
  overrides: Partial<ProjectAiDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const config = resolveConfig(dependencies);
  const provider = usableConfig(config);
  if (!provider) return { status: 'unavailable' as const, message: UNAVAILABLE_MESSAGE };
  if (config.provider !== 'local' && !callbacks.confirmExternal(`将向 ${provider.name} 发送工程摘要和最多 50 KB 的源码片段。是否继续？`)) {
    return { status: 'cancelled' as const };
  }
  callbacks.onStart();
  await dependencies.stream(config, [{ role: 'user', content: buildProjectAiPrompt(files, summary) }], callbacks.onChunk, callbacks.onDone, callbacks.onError);
  return { status: 'started' as const };
}
