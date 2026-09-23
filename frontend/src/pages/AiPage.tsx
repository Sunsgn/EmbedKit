import { useState, useRef, useEffect } from 'react';
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
  MessageSquare,
  Loader2,
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { chips } from '../data/chips';
import { AI_PROVIDERS, type ProviderKey, type AiConfig } from '../types/ai';
import { streamAiResponse } from '../services/aiService';

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

const DEFAULT_PROVIDER: ProviderKey = 'huggingface';
const DEFAULT_MODEL = 'meta-llama/Llama-3.3-70B-Instruct';

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
      content: '你好！我是你的嵌入式开发 AI 助手。我可以帮你生成代码、调试问题、架构设计等。\n\n请先点击右上角的设置图标配置 API Key，或直接使用模拟模式体验。',
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // AI Config (persisted to localStorage)
  const [config, setConfig] = useState<AiConfig>(() => {
    try {
      const saved = localStorage.getItem('embedkit-ai-config');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL, apiKey: '' };
  });

  useEffect(() => {
    localStorage.setItem('embedkit-ai-config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const providerInfo = AI_PROVIDERS[config.provider];
  const isBuiltInNoKey = !providerInfo.requiresKey;
  const isConfigured = isBuiltInNoKey || config.apiKey.length > 10 || (config.provider === 'custom' && (config.customEndpoint?.length || 0) > 5);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg: Message = { role: 'user', content: input, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    const userInput = input;
    setInput('');
    setIsTyping(true);
    setError(null);

    // If not configured, use simulated response
    if (!isConfigured) {
      await simulateResponse(userInput);
      return;
    }

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

  const simulateResponse = (userInput: string) => {
    const lower = userInput.toLowerCase();

    let response: { content: string; code?: string };

    if (lower.includes('uart') || lower.includes('serial')) {
      response = {
        content: `这是 ${selectedChip.name} 的 UART 配置。常见问题包括时钟配置、GPIO 模式设置和 NVIC 中断配置。`,
        code: `#include "stm32f1xx_hal.h"

UART_HandleTypeDef huart1;

void MX_USART1_UART_Init(void) {
    huart1.Instance = USART1;
    huart1.Init.BaudRate = 115200;
    huart1.Init.WordLength = UART_WORDLENGTH_8B;
    huart1.Init.StopBits = UART_STOPBITS_1;
    huart1.Init.Parity = UART_PARITY_NONE;
    huart1.Init.Mode = UART_MODE_TX_RX;
    huart1.Init.HwFlowCtl = UART_HWCONTROL_NONE;
    HAL_UART_Init(&huart1);
}

void HAL_UART_MspInit(UART_HandleTypeDef *huart) {
    GPIO_InitTypeDef GPIO_InitStruct = {0};
    __HAL_RCC_USART1_CLK_ENABLE();
    __HAL_RCC_GPIOA_CLK_ENABLE();

    GPIO_InitStruct.Pin = GPIO_PIN_9 | GPIO_PIN_10;
    GPIO_InitStruct.Mode = GPIO_MODE_AF_PP;
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_HIGH;
    HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);

    __HAL_AFIO_REMAP_USART1_DISABLE();
}`,
      };
    } else if (lower.includes('spi')) {
      response = {
        content: `这是 ${selectedChip.name} 的 SPI 驱动模板，使用 HAL 库。`,
        code: `#include "stm32f1xx_hal.h"

SPI_HandleTypeDef hspi1;

void MX_SPI1_Init(void) {
    hspi1.Instance = SPI1;
    hspi1.Init.Mode = SPI_MODE_MASTER;
    hspi1.Init.Direction = SPI_DIRECTION_2LINES;
    hspi1.Init.DataSize = SPI_DATASIZE_8BIT;
    hspi1.Init.CLKPolarity = SPI_POLARITY_LOW;
    hspi1.Init.CLKPhase = SPI_PHASE_1EDGE;
    hspi1.Init.NSS = SPI_NSS_SOFT;
    hspi1.Init.BaudRatePrescaler = SPI_BAUDRATEPRESCALER_16;
    hspi1.Init.FirstBit = SPI_FIRSTBIT_MSB;
    HAL_SPI_Init(&hspi1);
}

void SPI_Transfer(uint8_t* txData, uint8_t* rxData, uint16_t len) {
    HAL_SPI_TransmitReceive(&hspi1, txData, rxData, len, 1000);
}`,
      };
    } else if (lower.includes('freertos') || lower.includes('task') || lower.includes('rtos')) {
      response = {
        content: '这是 FreeRTOS 任务模板，包含队列和信号量。',
        code: `#include "FreeRTOS.h"
#include "task.h"
#include "queue.h"
#include "semphr.h"

#define QUEUE_SIZE    10
#define MSG_SIZE      sizeof(uint32_t)

static QueueHandle_t xMessageQueue;
static SemaphoreHandle_t xMutex;

void vSensorTask(void *pvParameters) {
    uint32_t ulSensorValue;

    xMessageQueue = xQueueCreate(QUEUE_SIZE, MSG_SIZE);
    xMutex = xSemaphoreCreateMutex();

    for (;;) {
        ulSensorValue = read_sensor();

        if (xSemaphoreTake(xMutex, portMAX_DELAY) == pdTRUE) {
            xQueueSend(xMessageQueue, &ulSensorValue, portMAX_DELAY);
            xSemaphoreGive(xMutex);
        }

        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

void vDataTask(void *pvParameters) {
    uint32_t ulReceivedValue;

    for (;;) {
        if (xQueueReceive(xMessageQueue, &ulReceivedValue, portMAX_DELAY) == pdTRUE) {
            process_data(ulReceivedValue);
        }
    }
}`,
      };
    } else if (lower.includes('i2c')) {
      response = {
        content: `这是 ${selectedChip.name} 的 I2C 驱动结构。`,
        code: `#include "stm32f1xx_hal.h"

I2C_HandleTypeDef hi2c1;

void MX_I2C1_Init(void) {
    hi2c1.Instance = I2C1;
    hi2c1.Init.ClockSpeed = 100000;
    hi2c1.Init.DutyCycle = I2C_DUTYCYCLE_2;
    hi2c1.Init.OwnAddress1 = 0;
    hi2c1.Init.AddressingMode = I2C_ADDRESSINGMODE_7BIT;
    hi2c1.Init.DualAddressMode = I2C_DUALADDRESS_DISABLE;
    hi2c1.Init.GeneralCallMode = I2C_GENERALCALL_DISABLE;
    hi2c1.Init.NoStretchMode = I2C_NOSTRETCH_DISABLE;
    HAL_I2C_Init(&hi2c1);
}

HAL_StatusTypeDef I2C_Write(uint8_t devAddr, uint8_t reg, uint8_t* data, uint16_t len) {
    return HAL_I2C_Mem_Write(&hi2c1, devAddr, reg, I2C_MEMADD_SIZE_8BIT, data, len, 1000);
}

HAL_StatusTypeDef I2C_Read(uint8_t devAddr, uint8_t reg, uint8_t* data, uint16_t len) {
    return HAL_I2C_Mem_Read(&hi2c1, devAddr, reg, I2C_MEMADD_SIZE_8BIT, data, len, 1000);
}`,
      };
    } else {
      response = {
        content: '我很乐意帮忙！针对你的目标芯片进行嵌入式开发时，建议考虑时钟树配置、外设初始化顺序和内存限制。需要我为你生成具体的代码吗？',
      };
    }

    setTimeout(() => {
      const assistantMsg: Message = {
        role: 'assistant',
        content: response.content,
        code: response.code,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 800 + Math.random() * 1200);
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
    setConfig({ provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL, apiKey: '' });
    localStorage.removeItem('embedkit-ai-config');
  };

  const currentModels = providerInfo.models;

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
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">模拟模式</span>
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
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              <X size={14} />
            </button>
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
              disabled={!input.trim() || isTyping}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Send size={16} />
            </button>
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
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
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
              <label className="block text-sm text-gray-400 mb-2">AI 提供商</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(AI_PROVIDERS) as [ProviderKey, typeof AI_PROVIDERS[ProviderKey]][]).map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => {
                      const firstModel = info.models[0]?.id;
                      setConfig(prev => ({ ...prev, provider: key, model: firstModel || '' }));
                    }}
                    className={`p-3 rounded-lg border text-sm transition-colors ${
                      config.provider === key
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-[#30363d] bg-[#0d1117] text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    <MessageSquare size={16} className="mb-1" />
                    <div>{info.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Provider Selection */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">服务提供方</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(AI_PROVIDERS) as ProviderKey[]).map((key) => {
                  const p = AI_PROVIDERS[key];
                  const isActive = config.provider === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setConfig(prev => ({ ...prev, provider: key, model: p.defaultModel }));
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${isActive ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'bg-[#0d1117] border-[#30363d] text-gray-400 hover:border-gray-600'}`}
                    >
                      <span className="text-base">{p.icon}</span>
                      <span className="truncate">{p.name}</span>
                      {!p.requiresKey && <span className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">免费</span>}
                    </button>
                  );
                })}
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
                <p className="text-xs text-gray-500 mt-1.5">
                  {config.provider === 'gemini'
                    ? '在 https://aistudio.google.com/apikey 获取 Gemini API Key'
                    : config.provider === 'openrouter'
                      ? '在 https://openrouter.ai/keys 获取 OpenRouter API Key（有免费额度）'
                      : ''}
                </p>
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

            {/* Hugging Face No-Key Notice */}
            {config.provider === 'huggingface' && (
              <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                <p className="text-xs text-emerald-400">✓ Hugging Face 无需 API Key，可直接使用</p>
              </div>
            )}

            {/* Model Selection */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">模型</label>
              <select
                value={config.model}
                onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              >
                {currentModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Status & Actions */}
            <div className="flex items-center justify-between">
              <div className={`text-xs px-2 py-1 rounded-full ${isConfigured ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                {isConfigured ? '✓ 已配置' : '未配置（使用模拟模式）'}
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
