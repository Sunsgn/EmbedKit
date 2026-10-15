import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AiPage from './AiPage';
import { detectLocalServers, streamAiResponse } from '../services/aiService';

vi.mock('@monaco-editor/react', () => ({ default: () => <div data-testid="code-editor" /> }));
vi.mock('../services/aiService', () => ({
  clearStoredAiConfig: vi.fn(),
  detectLocalServers: vi.fn(),
  loadStoredAiConfig: vi.fn(() => null),
  localProxyUrl: (target: string) => `http://127.0.0.1:9999/proxy/${target}`,
  persistAiConfig: vi.fn(),
  streamAiResponse: vi.fn(),
}));

describe('AiPage local Ollama availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    vi.mocked(detectLocalServers).mockResolvedValue([{ name: 'Ollama', url: 'http://localhost:11434', chatUrl: 'http://localhost:11434/v1/chat/completions', models: [] }]);
  });

  it('distinguishes a running Ollama service from an installed model', async () => {
    render(<AiPage />);

    expect(await screen.findByText('Ollama 无可用模型')).toBeVisible();
    expect(screen.getByText(/Ollama 服务已启动，但本机没有可用模型/)).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText('问我关于嵌入式开发的问题...'), { target: { value: '分析这段代码' } });
    expect(screen.getByRole('button', { name: '发送消息' })).toBeDisabled();
    expect(streamAiResponse).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('AI 设置'));
    expect(await screen.findByText(/服务已启动，但尚未安装模型/)).toBeVisible();
    expect(screen.getByText('ollama pull qwen2.5:7b')).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText('模型')).toBeDisabled());
  });
});
