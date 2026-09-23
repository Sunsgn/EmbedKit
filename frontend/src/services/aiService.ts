import { AI_PROVIDERS, type AiConfig } from '../types/ai';

const SYSTEM_PROMPT = `你是一个嵌入式开发AI助手。你精通嵌入式C语言开发、STM32、ESP32等芯片的HAL库和寄存器操作。
请用中文回答用户的问题。回答时注意：
1. 代码示例使用C语言，配合HAL库或标准库
2. 解释要简洁明了，重点突出
3. 如果涉及硬件操作，说明引脚配置和注意事项
4. 代码中不要添加注释，保持简洁`;

export async function streamAiResponse(
  config: AiConfig,
  messages: Array<{ role: string; content: string }>,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
) {
  if (!config.apiKey) {
    onError('请先配置 API Key');
    return;
  }

  try {
    if (config.provider === 'gemini') {
      await streamGemini(config, messages, onChunk, onDone, onError);
    } else if (config.provider === 'openrouter') {
      await streamOpenRouter(config, messages, onChunk, onDone, onError);
    }
  } catch (e: any) {
    onError(e.message || '请求失败');
  }
}

async function streamGemini(
  config: AiConfig,
  messages: Array<{ role: string; content: string }>,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
) {
  const provider = AI_PROVIDERS.gemini;
  const url = provider.endpoint.replace('{model}', config.model);

  const geminiMessages = [
    { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
    ...messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  ];

  const response = await fetch(`${url}?key=${config.apiKey}&alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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

  const reader = response.body?.getReader();
  if (!reader) {
    onError('不支持流式响应');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data) {
          try {
            const json = JSON.parse(data);
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              onChunk(text);
            }
          } catch {
            // ignore parse errors for partial JSON
          }
        }
      }
    }
  }

  onDone();
}

async function streamOpenRouter(
  config: AiConfig,
  messages: Array<{ role: string; content: string }>,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
) {
  const url = AI_PROVIDERS.openrouter.endpoint;

  const orMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages,
  ];

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'EmbedKit AI',
    },
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
    onError(`OpenRouter API 错误 (${response.status}): ${err}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError('不支持流式响应');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data && data !== '[DONE]') {
          try {
            const json = JSON.parse(data);
            const text = json.choices?.[0]?.delta?.content;
            if (text) {
              onChunk(text);
            }
          } catch {
            // ignore
          }
        }
      }
    }
  }

  onDone();
}
