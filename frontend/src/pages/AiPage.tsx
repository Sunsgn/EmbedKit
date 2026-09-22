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
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { chips } from '../data/chips';

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

export default function AiPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "你好！我是你的嵌入式开发 AI 助手。我可以帮你生成代码、调试问题、架构设计等。今天有什么可以帮你的？",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedChip, setSelectedChip] = useState(chips[0]);
  const [showCode, setShowCode] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateResponse = (userMessage: string): { content: string; code?: string } => {
    const lower = userMessage.toLowerCase();

    if (lower.includes('uart') || lower.includes('serial')) {
      return {
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
    }

    if (lower.includes('spi')) {
      return {
        content: `这是 ${selectedChip.name} 的 SPI 驱动模板，使用 HAL 库。该主设备配置使用默认引脚的 SPI1。`,
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
    }

    if (lower.includes('freertos') || lower.includes('task') || lower.includes('rtos')) {
      return {
        content: "这是针对目标芯片的 FreeRTOS 任务模板，包含队列和信号量的正确使用方式。",
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
    }

    if (lower.includes('i2c')) {
      return {
        content: `这是 ${selectedChip.name} 的 I2C 驱动结构。采用模块化设计，包含独立的初始化、读取和写入函数。`,
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
    }

    return {
      content: "我很乐意帮忙！针对你的目标芯片进行嵌入式开发时，建议考虑时钟树配置、外设初始化顺序和内存限制。需要我为你生成具体的代码吗？",
    };
  };

  const handleSend = () => {
    if (!input.trim() || isTyping) return;

    const userMsg: Message = { role: 'user', content: input, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    const userInput = input;
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const response = generateResponse(userInput);
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

  return (
    <div className="flex h-full bg-[#0d1117]">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-12 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-purple-400" />
            <span className="text-sm font-medium text-white">AI 助手</span>
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
              onClick={() => setMessages([{ role: 'assistant', content: "新会话已启动。有什么可以帮你的？", timestamp: new Date() }])}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#1c2128] transition-colors"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

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
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

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

          {isTyping && (
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

      {/* Quick Prompts Sidebar */}
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
    </div>
  );
}
