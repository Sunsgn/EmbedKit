import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Send,
  Code2,
  Lightbulb,
  Bug,
  GitPullRequest,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Terminal,
  Zap,
  Settings,
  X,
  Key,
  Loader2,
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { chips } from '../data/chips';
import { AI_PROVIDERS, type ProviderKey, type AiConfig } from '../types/ai';
import { clearStoredAiConfig, detectLocalServers, loadStoredAiConfig, localProxyUrl, persistAiConfig, streamAiResponse, type LocalServer } from '../services/aiService';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  code?: string;
  timestamp: Date;
}

const quickPrompts = [
  { icon: Bug, label: '调试 UART 不工作', prompt: '我的 STM32 UART 没有发送数据。帮我调试一下。' },
  { icon: Code2, label: '生成 SPI 驱动', prompt: '为 STM32F103 生成一个使用 HAL 库的 SPI 驱动。' },
  { icon: Lightbulb, label: 'FreeRTOS 任务模板', prompt: '创建一个带有队列和信号量的 FreeRTOS 任务模板。' },
  { icon: GitPullRequest, label: '重构 I2C 代码', prompt: '帮我重构 I2C 驱动，使其更加模块化。' },
];

// 新用户默认使用网页可访问的云端 API；本地 Ollama/LM Studio 继续作为隐私优先的可选方式。
const DEFAULT_PROVIDER: ProviderKey = 'openrouter';
const DEFAULT_MODEL = AI_PROVIDERS.openrouter.defaultModel;
const DEFAULT_LOCAL_ENDPOINT = localProxyUrl('http://localhost:11434/v1/chat/completions');
const PROVIDER_ORDER: ProviderKey[] = ['openrouter', 'gemini', 'custom', 'local', 'huggingface'];
const defaultAiConfig = (): AiConfig => ({ schemaVersion: 2, provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL, apiKey: '' });
const NO_LOCAL_MODELS_MESSAGE = 'Ollama 服务已启动，但本机没有可用模型。请先运行 ollama pull qwen2.5:7b，完成后在 AI 设置中点击“刷新”。';

function extractCode(content: string): string | undefined {
  const match = content.match(/```(\w+)?\n([\s\S]*?)```/);
  if (match) {
    return match[2].trim();
  }
  return undefined;
}

function extractText(content: string): string {
  const codeMatch = content.match(/```[\s\S]*?```/);
  if (codeMatch) {
    return content.replace(codeMatch[0], '').trim();
  }
  return content;
}

export default function AiPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '你好！我是嵌入式开发 AI 助手。我可以结合目标芯片帮你理解代码、分析日志和排查通信问题。\n\n默认使用云端网页 API，也可以在设置中切换到本地 Ollama 或 LM Studio。',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedChip, setSelectedChip] = useState(chips[0]);
  const [showCode, setShowCode] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedServers, setDetectedServers] = useState<LocalServer[]>([]);
  const [serverLoading, setServerLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // AI Config (persisted to localStorage)
  const [config, setConfig] = useState<AiConfig>(() => {
    try {
      const parsed = loadStoredAiConfig();
      if (parsed) {
        const legacyDefault = parsed.schemaVersion !== 2 && (
          (parsed.provider === 'huggingface' && !parsed.apiKey)
          || (parsed.provider === 'local' && parsed.model === 'qwen2.5:7b' && parsed.customEndpoint === DEFAULT_LOCAL_ENDPOINT)
        );
        if (legacyDefault) return defaultAiConfig();
        return { ...parsed, schemaVersion: 2 };
      }
    } catch { /* ignore */ }
    return defaultAiConfig();
  });

  const applyDetectedServers = useCallback((servers: LocalServer[]) => {
    setDetectedServers(servers);
    setServerLoading(false);
    const available = servers.flatMap(server => server.models.map(model => ({ server, model })));
    if (!available.length) {
      setError(current => servers.length ? NO_LOCAL_MODELS_MESSAGE : current === NO_LOCAL_MODELS_MESSAGE ? null : current);
      return;
    }
    setError(current => current === NO_LOCAL_MODELS_MESSAGE ? null : current);
    setConfig(previous => {
      const selected = available.find(item => item.model.id === previous.model) ?? available[0];
      const endpoint = localProxyUrl(selected.server.chatUrl);
      return previous.model === selected.model.id && previous.customEndpoint === endpoint
        ? previous
        : { ...previous, model: selected.model.id, customEndpoint: endpoint };
    });
  }, []);

  useEffect(() => {
    persistAiConfig(config);
  }, [config]);

  // Detect local servers when local provider is selected
  useEffect(() => {
    if (config.provider === 'local') {
      detectLocalServers().then(applyDetectedServers).catch(() => setServerLoading(false));
    }
  }, [applyDetectedServers, config.provider]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const providerInfo = AI_PROVIDERS[config.provider];
  const detectedLocalModels = detectedServers.flatMap(server => server.models);
  const localServiceWithoutModels = config.provider === 'local' && !serverLoading && detectedServers.length > 0 && detectedLocalModels.length === 0;
  const detectedLocalModelSelected = detectedLocalModels.some(model => model.id === config.model);
  const hasManualLocalConfig = Boolean(config.customEndpoint && config.customEndpoint !== DEFAULT_LOCAL_ENDPOINT && config.model.trim());
  const isConfigured = config.provider === 'local'
    ? !serverLoading && !localServiceWithoutModels && (detectedLocalModelSelected || hasManualLocalConfig)
    : config.provider === 'custom'
      ? (config.customEndpoint?.length || 0) > 5
      : providerInfo.requiresKey
        ? config.apiKey.length > 10
        : true;

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    if (!isConfigured) {
      setError(config.provider === 'local' ? '请先选择已安装的本地模型，或填写可用的本地兼容端点。' : '请先在 AI 设置中填写云端服务 API Key。');
      setShowSettings(true);
      return;
    }
    if (localServiceWithoutModels) {
      setError(NO_LOCAL_MODELS_MESSAGE);
      setShowSettings(true);
      return;
    }

    const userMsg: Message = { role: 'user', content: input, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    const userInput = input;
    setInput('');
    setIsTyping(true);
    setError(null);

    // Build conversation history
    const history = messages
      .filter(m => m.content)
      .map(m => ({ role: m.role, content: m.content }));

    // Add chip context to user input
    const enhancedInput = `[目标芯片: ${selectedChip.name} (${selectedChip.series})]\n${userInput}`;

    // Create placeholder for assistant response
    const assistantIndex = messages.length + 1;
    setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: new Date() }]);

    let fullContent = '';

    try {
      await streamAiResponse(
        config,
        [...history.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: enhancedInput }],
        (chunk) => {
          fullContent += chunk;
          const code = extractCode(fullContent);
          const text = extractText(fullContent);
          setMessages(prev => {
            const updated = [...prev];
            updated[assistantIndex] = {
              ...updated[assistantIndex],
              content: text,
              code: code,
            };
            return updated;
          });
        },
        () => {
          setIsTyping(false);
        },
        (err) => {
          setError(err);
          setMessages(prev => prev.slice(0, -1));
          setIsTyping(false);
        },
      );
    } catch {
      setError('请求失败，请检查网络连接');
      setMessages(prev => prev.slice(0, -1));
      setIsTyping(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  const handleCopyCode = (index: number) => {
    const msg = messages[index];
    if (msg.code) {
      navigator.clipboard.writeText(msg.code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const handleClearConfig = () => {
    setConfig(defaultAiConfig());
    clearStoredAiConfig();
  };

  const activateFreeCloud = () => {
    setConfig(defaultAiConfig());
    setError(null);
    setShowSettings(true);
  };

  const currentModels = config.provider === 'local'
    ? detectedServers.flatMap(s => s.models.map(m => ({ id: m.id, label: `${s.name}: ${m.name}${m.size ? ` (${m.size})` : ''}` })))
    : providerInfo.models;

  return (
    <div className="flex h-full bg-[#0d1117]">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-12 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-purple-400" />
            <span className="text-sm font-medium text-white">AI 助手</span>
            {!isConfigured && (
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">{localServiceWithoutModels ? 'Ollama 无可用模型' : '未配置'}</span>
            )}
            {isConfigured && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                {providerInfo.icon} {providerInfo.name} / {currentModels.find(m => m.id === config.model)?.label || config.model}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#0d1117] rounded-lg px-3 py-1.5">
              <Cpu size={14} className="text-blue-400" />
              <select
                value={selectedChip.id}
                onChange={(e) => {
                  const chip = chips.find((c) => c.id === e.target.value);
                  if (chip) setSelectedChip(chip);
                }}
                className="bg-transparent text-sm text-gray-300 outline-none cursor-pointer"
              >
                {chips.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setMessages([{ role: 'assistant', content: '新会话已启动。有什么可以帮你的？', timestamp: new Date() }])}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#1c2128] transition-colors"
              title="新对话"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#1c2128] transition-colors"
              title="AI 设置"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-2 flex items-center justify-between">
            <span className="text-sm text-red-400">{error}</span>
            <div className="flex shrink-0 items-center gap-3">
              {localServiceWithoutModels && <button type="button" onClick={activateFreeCloud} className="text-xs text-blue-300 hover:text-blue-200">切换免费云端</button>}
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300" aria-label="关闭错误提示"><X size={14} /></button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#161b22] text-gray-200 border border-[#30363d]'
                }`}
              >
                {msg.content && (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}

                {!msg.content && isTyping && i === messages.length - 1 && (
                  <div className="flex gap-1.5 py-1">
                    <Loader2 size={14} className="text-gray-500 animate-spin" />
                    <span className="text-xs text-gray-500">思考中...</span>
                  </div>
                )}

                {msg.code && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <button
                        onClick={() => setShowCode(showCode === i ? null : i)}
                        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
                      >
                        <Code2 size={12} />
                        {showCode === i ? '隐藏代码' : '显示代码'}
                        {showCode === i ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                      <button
                        onClick={() => handleCopyCode(i)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                      >
                        {copiedIndex === i ? <Check size={12} /> : <Copy size={12} />}
                        {copiedIndex === i ? '已复制' : '复制'}
                      </button>
                    </div>
                    {showCode === i && (
                      <div className="mt-2 rounded-lg overflow-hidden border border-[#30363d]">
                        <Editor
                          height={200}
                          language="c"
                          value={msg.code}
                          theme="vs-dark"
                          options={{
                            readOnly: true,
                            fontSize: 12,
                            minimap: { enabled: false },
                            automaticLayout: true,
                            scrollBeyondLastLine: false,
                            lineNumbers: 'on',
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className={`text-xs mt-1.5 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>
                  {msg.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}

          {isTyping && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-[#161b22] border border-[#30363d] rounded-xl px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[#30363d] bg-[#161b22] p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="问我关于嵌入式开发的问题..."
              className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping || !isConfigured || localServiceWithoutModels}
              aria-label="发送消息"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-gray-500">
            <p>{config.provider === 'local'
              ? '本地模式：对话发送到你配置的本机模型服务。'
              : `云端模式：发送时仅将当前对话和所选芯片信息传输至 ${providerInfo.name}，不会自动上传工程文件。`}</p>
            {!isConfigured && <button type="button" onClick={() => setShowSettings(true)} className="shrink-0 text-blue-300 hover:text-blue-200">配置 AI 服务</button>}
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-64 bg-[#161b22] border-l border-[#30363d] flex flex-col">
        <div className="px-3 py-2 border-b border-[#30363d]">
          <span className="text-xs font-semibold text-gray-400 uppercase">快捷提示</span>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1.5">
          {quickPrompts.map((qp, i) => (
            <button
              key={i}
              onClick={() => handleQuickPrompt(qp.prompt)}
              className="w-full text-left p-2.5 rounded-lg bg-[#0d1117] hover:bg-[#1c2128] transition-colors group"
            >
              <div className="flex items-center gap-2 text-gray-400 group-hover:text-white mb-1">
                <qp.icon size={14} />
                <span className="text-xs font-medium">{qp.label}</span>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">{qp.prompt}</p>
            </button>
          ))}

          <div className="mt-4 px-2">
            <span className="text-xs font-semibold text-gray-400 uppercase">使用技巧</span>
            <div className="mt-2 space-y-2 text-xs text-gray-500">
              <div className="flex items-start gap-2">
                <Zap size={12} className="mt-0.5 text-yellow-400 shrink-0" />
                <span>指定芯片型号以获得更准确的代码</span>
              </div>
              <div className="flex items-start gap-2">
                <Terminal size={12} className="mt-0.5 text-green-400 shrink-0" />
                <span>粘贴错误信息以获取调试帮助</span>
              </div>
              <div className="flex items-start gap-2">
                <Code2 size={12} className="mt-0.5 text-blue-400 shrink-0" />
                <span>可以要求生成特定外设的代码</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowSettings(false)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-[#30363d] bg-[#161b22] p-6 scrollbar-thin" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Settings size={18} className="text-blue-400" />
                AI 设置
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Provider Selection */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">服务提供方</label>
              <div className="grid grid-cols-2 gap-2">
                {PROVIDER_ORDER.map((key) => {
                  const p = AI_PROVIDERS[key];
                  const isActive = config.provider === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (key === 'local') setServerLoading(true);
                        setConfig(prev => ({ ...prev, schemaVersion: 2, provider: key, model: p.defaultModel, apiKey: key === prev.provider ? prev.apiKey : '' }));
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${isActive ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'bg-[#0d1117] border-[#30363d] text-gray-400 hover:border-gray-600'}`}
                    >
                      <span className="text-base">{p.icon}</span>
                      <span className="truncate">{p.name}</span>
                      {key === 'openrouter' ? (
                        <span className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">云端优先</span>
                      ) : !p.requiresKey && (
                    <>
                      {key === 'huggingface' ? (
                        <span className="ml-auto text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded" title="在线部署时可能受浏览器 CORS 限制">受限</span>
                      ) : key === 'local' ? (
                        <span className="ml-auto text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">本地</span>
                      ) : (
                        <span className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">免费</span>
                      )}
                    </>
                  )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2">
                <p className="text-xs text-gray-400">💡 <span className="text-gray-300 font-medium">默认</span>：网页端优先使用 <span className="text-blue-400">OpenRouter</span>；需要源码留在本机时切换到 Ollama 或 LM Studio。</p>
                <p className="text-xs text-gray-500 mt-1">Hugging Face 在本地开发环境（localhost）正常工作，GitHub Pages 部署可能受限</p>
              </div>
            </div>

            {/* API Key (for providers that require it) */}
            {providerInfo.requiresKey && config.provider !== 'custom' && (
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">API Key</label>
                <div className="relative">
                  <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="password"
                    value={config.apiKey}
                    onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder={`输入 ${providerInfo.name} API Key`}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500"
                  />
                </div>
                {config.provider === 'gemini' && <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-xs text-blue-300 hover:underline">打开 Gemini API Key 页面</a>}
                {config.provider === 'openrouter' && <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-xs text-blue-300 hover:underline">免费登录并获取 OpenRouter API Key</a>}
                <p className="mt-2 text-[10px] text-yellow-300">云端请求会发送当前对话和所选芯片信息；不会自动读取或上传本地工程。</p>
              </div>
            )}

            {/* Custom Provider Fields */}
            {config.provider === 'custom' && (
              <div className="mb-4 space-y-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">API 端点</label>
                  <input
                    type="text"
                    value={config.customEndpoint}
                    onChange={(e) => setConfig(prev => ({ ...prev, customEndpoint: e.target.value }))}
                    placeholder="https://api.example.com/v1/chat/completions"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">API Key（可选）</label>
                  <input
                    type="password"
                    value={config.customApiKey}
                    onChange={(e) => setConfig(prev => ({ ...prev, customApiKey: e.target.value }))}
                    placeholder="输入自定义 API Key"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Local Provider Fields */}
            {config.provider === 'local' && (
              <div className="mb-4 space-y-3">
                {/* Auto-detected servers */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm text-gray-400">本地服务器</label>
                    <button
                      type="button"
                      onClick={async () => {
                        setServerLoading(true);
                        try { applyDetectedServers(await detectLocalServers()); }
                        catch { setServerLoading(false); }
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <RefreshCw size={12} className={serverLoading ? 'animate-spin' : ''} />
                      刷新
                    </button>
                  </div>
                  {serverLoading ? (
                    <div className="flex items-center justify-center py-4 text-gray-500 text-xs">
                      <Loader2 size={14} className="animate-spin mr-2" />
                      检测中...
                    </div>
                  ) : detectedServers.length > 0 ? (
                    <div className="space-y-2">
                      {detectedServers.map(server => (
                        <button
                          key={server.name}
                          type="button"
                          disabled={!server.models.length}
                          onClick={() => {
                            const firstModel = server.models[0];
                            if (firstModel) {
                              setConfig(prev => ({
                                ...prev,
                                model: firstModel.id,
                                customEndpoint: localProxyUrl(server.chatUrl),
                              }));
                            }
                          }}
                          className={`w-full text-left p-2 rounded-lg border transition-all disabled:cursor-not-allowed ${!server.models.length ? 'border-yellow-500/30 bg-yellow-500/10' : config.customEndpoint?.includes(server.chatUrl) ? 'bg-blue-500/20 border-blue-500' : 'bg-[#0d1117] border-[#30363d] hover:border-gray-600'}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-white font-medium">{server.name}</span>
                            <span className="text-xs text-gray-500">{server.models.length} 个模型</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{server.url}</div>
                          {!server.models.length && <div className="mt-1.5 text-xs text-yellow-300">服务已启动，但尚未安装模型。运行：<code className="rounded bg-yellow-500/20 px-1">ollama pull qwen2.5:7b</code></div>}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {server.models.slice(0, 3).map(m => (
                              <span key={m.id} className={`text-[10px] px-1.5 py-0.5 rounded ${config.model === m.id ? 'bg-blue-500/30 text-blue-300' : 'bg-gray-700 text-gray-400'}`}>
                                {m.name}{m.size ? ` (${m.size})` : ''}
                              </span>
                            ))}
                            {server.models.length > 3 && (
                              <span className="text-[10px] text-gray-500">+{server.models.length - 3}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2.5">
                      <p className="text-xs text-yellow-400 font-medium mb-1">未检测到本地 AI 服务</p>
                      <p className="text-xs text-gray-400">请先启动以下任一 OpenAI 兼容本地服务：</p>
                      <p className="text-xs text-gray-500 mt-0.5">• Ollama: 运行 <code className="bg-yellow-500/20 px-1 rounded">ollama serve</code></p>
                      <p className="text-xs text-gray-500">• LM Studio: 启动并开启 Local Server</p>
                      <p className="text-xs text-gray-500">• 其他：LocalAI、llama.cpp、vLLM、Jan、GPT4All、KoboldCpp</p>
                    </div>
                  )}
                </div>

                {/* Manual endpoint */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">API 端点</label>
                  <input
                    type="text"
                    value={config.customEndpoint || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, customEndpoint: e.target.value }))}
                    placeholder="http://localhost:11434/v1/chat/completions"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">API Key（可选）</label>
                  <input
                    type="password"
                    value={config.customApiKey || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, customApiKey: e.target.value }))}
                    placeholder="Ollama 不需要 API Key"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500"
                  />
                </div>

                {/* CORS Instructions */}
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
                  <p className="text-xs text-yellow-400 font-bold mb-1">⚠️ 重要：必须配置 CORS 才能使用</p>
                  <p className="text-xs text-yellow-400">由于网站部署在 github.io，浏览器会阻止直接访问 localhost。请选择以下一种方式：</p>
                  <p className="text-xs text-gray-400 mt-1">方法 1（推荐）：使用 EmbedKit 代理</p>
                  <p className="text-xs text-gray-500 ml-2">1. 在终端运行：<code className="bg-yellow-500/20 px-1 rounded">cd EmbedKit/proxy &amp;&amp; npm start</code></p>
                  <p className="text-xs text-gray-500 ml-2">2. 上方会自动检测到你的本地服务，点击即可配置</p>
                  <p className="text-xs text-gray-400 mt-1">方法 2：配置服务器 CORS</p>
                  <p className="text-xs text-gray-500 ml-2">Ollama：<code className="bg-yellow-500/20 px-1 rounded">OLLAMA_ORIGINS=*</code> 环境变量后重启</p>
                  <p className="text-xs text-gray-500 ml-2">LM Studio：Settings → Security → 勾选 "CORS"</p>
                </div>
              </div>
            )}

            {/* Hugging Face Notice */}
            {config.provider === 'huggingface' && (
              <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
                <p className="text-xs text-yellow-400">⚠️ Hugging Face 在线部署时可能因浏览器 CORS 限制无法使用。如遇"Failed to fetch"错误，请切换为 OpenRouter（有免费模型）或使用模拟模式。</p>
              </div>
            )}

            {/* Model Selection */}
            <div className="mb-4">
              <label htmlFor="ai-model-select" className="block text-sm text-gray-400 mb-2">模型</label>
              <select
                id="ai-model-select"
                value={config.model}
                disabled={localServiceWithoutModels}
                onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              >
                {localServiceWithoutModels && <option value={config.model}>请先安装 Ollama 模型</option>}
                {currentModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Status & Actions */}
            <div className="flex items-center justify-between">
              <div className={`text-xs px-2 py-1 rounded-full ${isConfigured ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                {isConfigured ? '✓ 已配置' : localServiceWithoutModels ? '缺少本地模型' : '未配置'}
              </div>
              <div className="flex gap-2">
                {isConfigured && (
                  <button
                    onClick={handleClearConfig}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                  >
                    清除配置
                  </button>
                )}
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg transition-colors"
                >
                  完成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
